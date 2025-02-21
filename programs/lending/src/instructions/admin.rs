use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use crate::state::*;

#[derive(Accounts)]
pub struct InitBank<'info> {
   #[account(mut)]
   pub signer: Signer<'info>,

   pub mint: InterfaceAccount<'info, Mint>,

   #[account(
      init, 
      payer=signer, 
      space=8+Bank::INIT_SPACE, 
      // Since we are going to make this account a PDA we will define the seeds and bump
      // Every bank is going to have a unique mint key for the asset that correlates to the bank 
      seeds=[mint.key().as_ref()],
      // seeds=[signer.key().as_ref()],
      bump,
   )]
   pub bank: Account<'info, Bank>,

   // We will need to have a token account to hold the tokens for the bank, and this will initialize the token account
   #[account(
      init,
      token::mint = mint, // We are going to set that this is for tokens and we are going to take the mint of the mint account that we are passing through 
      token::authority = bank_token_account, // We are going to set the authority to itself(that is going to be the bank_token_account)
      payer = signer, 
      // We dont want to use an associated token account we just want to have token account with a pda, so we are able to know that this account is specific to the lending protocol bank
      seeds = [b"treasury", mint.key().as_ref()],
      bump
   )]
   pub bank_token_account: InterfaceAccount<'info, TokenAccount>,

   // Because we are creating new token accounts 
   pub token_program: Interface<'info, TokenInterface>,

   // Because we are initializing a new account we need to pass through the system program
   pub system_program: Program<'info, System>,

}

#[derive(Accounts)]
pub struct InitUser<'info> {
   #[account(mut)]
   pub signer: Signer<'info>,

   #[account(
      init,
      payer = signer,
      space = 8 + User::INIT_SPACE,
      seeds = [signer.key().as_ref()],
      bump
   )]
   pub user_account: Account<'info, User>, 

   // Because we are initializing a new account we need to pass through the system program
   pub system_program: Program<'info, System>,
}

// The initialization happened in the struct, so we save the information we need to the account state for the bank
pub fn process_init_bank(ctx: Context<InitBank>, liquidation_threshold: u64, max_ltv: u64) -> Result<()> {
   let bank = &mut ctx.accounts.bank; // We take a mutable reference or a mutable borrow
   bank.mint_address = ctx.accounts.mint.key();
   bank.authority = ctx.accounts.signer.key();
   bank.liquidation_threshold = liquidation_threshold; 
   bank.max_ltv = max_ltv;
   Ok(())
}

pub fn process_init_user(ctx: Context<InitUser>, usdc_address: Pubkey) -> Result<()> {
   let user_account = &mut ctx.accounts.user_account;
   user_account.owner = ctx.accounts.signer.key();
   user_account.usdc_address = usdc_address;
   Ok(())
}