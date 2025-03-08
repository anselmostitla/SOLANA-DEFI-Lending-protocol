use anchor_lang::prelude::*;
use anchor_spl::{
   token::Transfer,
   associated_token::AssociatedToken,
   token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::{Bank, User};
use crate::error::ErrCode;

#[derive(Accounts)]
pub struct Borrow<'info> {
   // signer
   #[account(mut)]
   pub signer: Signer<'info>,

   // mintUsdc (will be the asset to borrow, assuming mintSol is deposited)
   pub mint: InterfaceAccount<'info, Mint>,

   // bank
   #[account(
      mut,
      seeds = [mint.key().as_ref()],
      bump,
   )]
   pub bank: Account<'info, Bank>,

   // bank pda
   #[account(
      mut, // because I will transfer tokens from this account to user_token_account
      token::mint = mint,
      token::authority = bank,
      seeds = [b"treasury", mint.key().as_ref()],
      bump,
   )]
   pub bank_token_account: InterfaceAccount<'info, TokenAccount>,

   // user
   #[account(
      mut, // becuase I will update the user state 
      seeds = [signer.key().as_ref()],
      bump,
   )]
   pub user: Account<'info, User>,

   // associate user account (will receive the borrowing)
   #[account(
      mut,
      token::mint = mint,
      token::authority = signer,
   )]
   pub user_token_account: InterfaceAccount<'info, TokenAccount>,

   /*
      If the token you want to borrow is not already initialized it means you can't borrow it.
      Thus the token you want to borrow should already have been initialized.
   */
   
   // pub token_program: Program<'info, TokenInterface>,
   pub token_program: Interface<'info, TokenInterface>,

   // associate token program
   pub associated_token_program: Program<'info, AssociatedToken>
}

pub fn process_borrow(ctx: Context<Borrow>, amount_to_borrow:u64) -> Result<()> {
   // Check if there is collateral (that is if there is sol deposited)
   let user = &mut ctx.accounts.user;
   let bank = &mut ctx.accounts.bank;
   
   if user.deposited_sol <= 0 {
      return Err(ErrCode::InsuficientSol.into());
   }
      
   // Determined the maximum amount for borrowing (borrow_maximum_amount)
   // Get the value of sol in usdc and compute ltv amount
   let sol_usdc_price = 1;
   let sol_in_usdc = user.deposited_sol * sol_usdc_price;
   let borrow_maximum_amount = sol_in_usdc * bank.max_ltv;

   // Check for appropiate desired amount of borrowing (amount_to_borrow < borrow_maximum_amount)
   if amount_to_borrow > borrow_maximum_amount {
      return Err(ErrCode::InsufficientAmountToBorrow.into());
   }

   let mint_key = ctx.accounts.mint.key();
   let bumbs = ctx.bumps.bank;
   let seeds = &[mint_key.as_ref(), &[bumbs]];
   let signer_seeds = &[&seeds[..]];

   // Transfer asset_to_borrow to user
   let cpi_program = ctx.accounts.token_program.to_account_info();
   let cpi_ctx = CpiContext::new_with_signer(
      cpi_program,
      Transfer {
         from: ctx.accounts.bank_token_account.to_account_info(),
         to: ctx.accounts.user_token_account.to_account_info(),
         authority: ctx.accounts.signer.to_account_info(),
      },
      signer_seeds,
   );
   anchor_spl::token::transfer(cpi_ctx, amount_to_borrow)?;
   
   // Update bank state
   // Update use state
   Ok(())
}