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

   // // We need to withdraw from the bank_token_account pda
   // #[account(
   //    mut,
   //    // token::mint = mint,
   //    // token::authority = bank,
   //    seeds = [b"treasury", mint.key().as_ref()],
   //    bump
   // )]
   // pub bank_token_account: InterfaceAccount<'info, TokenAccount>,

   #[account(
      mut, // This will mutable because we are depositing into the account
      token::mint = mint, // (NOT associated_token::mint = mint)
      token::authority = bank, // (NEITHER associated_token::authority = bank NOR associated_token::authority = bank_token_account)
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
   let user = &mut ctx.accounts.user_account;

   let deposited_value: u64;
   if ctx.accounts.mint.to_account_info().key() == user.usdc_address {
      deposited_value = user.deposited_usdc;
   } else {
      deposited_value = user.deposited_sol;
   }

   if amount > deposited_value {
      return Err(ErrCode::InsufficientFunds.into());
   }

   let mint_key = ctx.accounts.mint.key();

   let bumps = ctx.bumps.bank;
   let seeds = &[mint_key.as_ref(), &[bumps]];
   let signer = &[&seeds[..]];


   let cpi_ctx = CpiContext::new_with_signer(
      ctx.accounts.token_program.to_account_info().clone(),
      Transfer{
         from: ctx.accounts.bank_token_account.to_account_info(),
         to: ctx.accounts.user_token_account.to_account_info(),
         authority: ctx.accounts.bank.to_account_info(),
      },
      signer,   
   );
      
   anchor_spl::token::transfer(cpi_ctx, amount)?;

   // After withdrawing or transfer success, we need to update the state

   let bank = &mut ctx.accounts.bank;
   let shares_to_remove = (amount as f64 / bank.total_deposits as f64) * bank.total_deposit_shares as f64; 
   /*
      L0 - L1 = s/T * L0 the liquidity to decrease from L0 to L1 must be proportional to the amount of shares to burn multiply by the current liquidity.
      L0 - L1 / L0 = dx / x0 = dy / y0
      => dx = x0 * s/T   and   dy = y0 * s/T
   */
   

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