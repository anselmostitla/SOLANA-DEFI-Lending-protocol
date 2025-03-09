use std::f64::consts::E;

use anchor_lang::prelude::*;
// use anchor_spl::{associated_token::AssociatedToken, token::TransferChecked, token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked}};
// use anchor_spl::associated_token::AssociatedToken;
// use anchor_spl::token::Transfer;
// use anchor_spl::token_interface::{ Mint, TokenAccount, TokenInterface };
use anchor_spl::{
   associated_token::AssociatedToken,
   token::Transfer,
   token_interface::{ Mint, TokenAccount, TokenInterface }
};



// use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use crate::state::{Bank, User};
use crate::error::ErrCode;


#[derive(Accounts)]
pub struct Withdraw<'info> {
   
   #[account(mut)]
   pub signer: Signer<'info>,

   pub mint: InterfaceAccount<'info, Mint>,

   // Load the bank account
   #[account(
      mut,
      seeds=[mint.key().as_ref()],
      bump,
   )]
   pub bank: Account<'info, Bank>,

   #[account(
      mut, // This will mutable because we are depositing into the account
      token::mint = mint, // (NOT associated_token::mint = mint)
      token::authority = bank_token_account, // (NEITHER associated_token::authority = bank NOR associated_token::authority = bank_token_account)
      seeds = [b"treasury", mint.key().as_ref()], // Add seeds for PDA
      bump, 
   )]
   pub bank_token_account: InterfaceAccount<'info, TokenAccount>,

   #[account(
      mut,
      seeds = [signer.key().as_ref()],
      bump
   )]
   pub user_account: Account<'info, User>, 

   #[account(
      mut,
      // init_if_needed,
      // payer = signer,
      token::mint = mint,
      token::authority = signer,
      // token::token_program = token_program,
   )]
   pub user_token_account: InterfaceAccount<'info, TokenAccount>,

   pub token_program: Interface<'info, TokenInterface>,
   pub associated_token_program: Program<'info, AssociatedToken>,
   pub system_program: Program<'info, System>
}

pub fn process_withdraw(ctx: Context<Withdraw>, amount:u64) -> Result<()> {
   let bank = &mut ctx.accounts.bank;
   let user = &mut ctx.accounts.user_account;

   let deposited_value: u64;
   if ctx.accounts.mint.to_account_info().key() == user.usdc_address {
      deposited_value = user.deposited_usdc;
   } else {
      deposited_value = user.deposited_sol;
   }

   /*
      To compute the interest on an investment, the classical formula is:
      principal * (1 + r*days/365)^(365/days) = principal * (1+r/t)^t -> principal*exp(rt)  // t=1 means one year
   */

   // Get the elements for computing the interest
   let last_updated = bank.last_updated;
   let elapsed_time = Clock::get()?.unix_timestamp - last_updated;
   // let elapsed_time = 60*60*24*365;
   let interest_rate = bank.interest_rate;

   bank.total_deposits = ( (bank.total_deposits as f64) * E.powf((elapsed_time as f64) * (interest_rate as f64)/ (60.0 * 60.0 * 24.0 * 365.0)) ) as u64;

   if amount > deposited_value {
      return Err(ErrCode::InsufficientFunds.into()); 
   }

   let mint_key = ctx.accounts.mint.key();

   let bumps = ctx.bumps.bank_token_account;
   let seeds = &[b"treasury", mint_key.as_ref(), &[bumps]];
   let signer = &[&seeds[..]];


   let cpi_ctx = CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info().clone(),
      Transfer{
         from: ctx.accounts.bank_token_account.to_account_info(),
         to: ctx.accounts.user_token_account.to_account_info(),
         authority: ctx.accounts.bank_token_account.to_account_info(),
      },
      signer,   
   );
      
   anchor_spl::token::transfer(cpi_ctx, amount)?;

   // After withdrawing or transfer success, we need to update the state

   /*
      A SIMPLE RULE OF THREE
      total_shares   -->      total_deposits
            x        -->      withdrawal_amount
   */

   let shares_to_remove = bank.total_deposit_shares * amount / bank.total_deposits;
   

   if ctx.accounts.mint.to_account_info().key() == user.usdc_address {
      user.deposited_usdc -= amount;
      user.deposited_usdc_shares -= shares_to_remove as u64;
   } else {
      user.deposited_sol -= amount;
      user.deposited_sol_shares -= shares_to_remove as u64;
   }

   bank.total_deposits -= amount;
   bank.total_deposit_shares -= shares_to_remove as u64;

   Ok(())
}

pub fn calculate_interest(principal: f64, interest_rate: f64, time: f64) -> f64{
   principal * (interest_rate*time).exp()
}