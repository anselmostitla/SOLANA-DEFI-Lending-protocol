use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked}};
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


/*
We nee to make the logic to make a deposit into the protocol
*/

pub fn process_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
   let transfer_cpi_accounts = TransferChecked {
      from: ctx.accounts.user_token_account.to_account_info(),
      to: ctx.accounts.bank_token_account.to_account_info(),
      authority: ctx.accounts.signer.to_account_info(), // because the signer owns the user_token_account
      mint: ctx.accounts.mint.to_account_info(),
   };

   // Now we need to defined the CPI program that's gonna be used and since all the tokens that we are going to be transferring will be interface account tokens we can use the token program
   let cpi_program = ctx.accounts.token_program.to_account_info();
   let cpi_ctx = CpiContext::new(cpi_program, transfer_cpi_accounts);

   let decimals = ctx.accounts.mint.decimals;

   let _ = token_interface::transfer_checked(cpi_ctx, amount, decimals);

   // update state of user token account and bank token account

   let bank  =&mut ctx.accounts.bank;

   if bank.total_deposits == 0 {
      bank.total_deposits = amount;
      bank.total_deposit_shares = amount;
   }

   let deposit_ratio = amount.checked_div(bank.total_deposit_shares).unwrap();
   let user_shares = bank.total_deposit_shares.checked_mul(deposit_ratio).unwrap();

   let user = &mut ctx.accounts.user_account;
   match ctx.accounts.mint.to_account_info().key() {
      key if key == user.usdc_address => {
         user.deposited_usdc += amount;
         user.deposited_usdc_shares += user_shares;
      },
      _ => {
         user.deposited_sol += amount;
         user.deposited_sol_shares += user_shares;
      },
   }

   bank.total_deposits += amount;
   bank.total_deposit_shares += user_shares;

   Ok(())
}