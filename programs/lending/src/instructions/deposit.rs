use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface}};
use crate::state::{Bank, User}; 

#[derive(Accounts)]
pub struct Deposit<'info> {
   #[account(mut)]
   signer: Signer<'info>,

   pub mint: InterfaceAccount<'info, Mint>,

   // Let's load the bank account
   #[account(
      mut,
      seeds = [mint.key().as_ref()], // we'll need the seeds as how they were defined
      bump,
   )]
   pub bank: Account<'info, Bank>,

   // When you deposit a token to a bank that token will be send to I think to the "bank token account"
   // So we are going to need the bank token account as well
   #[account(
      mut, // This will mutable because we are depositing into the account
      seeds = [b"treasury", mint.key().as_ref()],
      bump,
   )]
   pub bank_token_account: InterfaceAccount<'info, TokenAccount>,

   // The next account will need is the user account which is storing all the information for the specific user who is using the lending protocol
   #[account(
      mut,
      seeds = [signer.key().as_ref()],
      bump,
   )]
   pub user_account: Account<'info, User>,

   // Now we need a user_token_account that is going to take the tokens that we are depositing and transfering into the bank token account
   // This will be an associated token account ot the mint addres of the token that they're depositting into the bank account
   // So we are going to load in the associated token account for this mint addrress for the user
   #[account(
      mut, 
      associated_token::mint = mint,
      associated_token::authority = signer,
      associated_token::token_program = token_program,
   )]
   pub user_token_account: InterfaceAccount<'info, TokenAccount>,

   pub token_program: Interface<'info, TokenInterface>,
   pub system_program: Program<'info, System>,
   pub associated_token_program: Program<'info, AssociatedToken>,
}

/*
We have the bank that has the state for the bank.
We have the bank_token_account that is holding the tokens for the bank
We have the user_account that is the state for the user
Now we need a user_token_account
*/


