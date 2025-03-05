use anchor_lang::prelude::*;
use anchor_spl::{
   associated_token::AssociatedToken, 
   token::{mint_to, MintTo}, 
   token_interface::{Mint, TokenAccount, TokenInterface} 
};


#[derive(Accounts)]
pub struct MintTokens<'info> {
   #[account(mut)]
   pub signer: Signer<'info>,

   pub mint: InterfaceAccount<'info, Mint>,

   #[account(
      mut, 
      token::mint = mint,
      token::authority = signer,
      seeds = [b"user", signer.key().as_ref()],
      bump 
   )]
   pub user_token_account: InterfaceAccount<'info, TokenAccount>,

   pub system_program: Program<'info, System>,
   // pub token_program: Program<'info, Token>,
   pub token_program: Interface<'info, TokenInterface>, 
   pub associated_token_program: Program<'info, AssociatedToken>

}

pub fn process_mint_tokens(ctx: Context<MintTokens>, quantity:u64) -> Result<()> {

   mint_to(
      CpiContext::new(
         ctx.accounts.token_program.to_account_info(), 
         MintTo{
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info()
         },
      ),
      quantity
   )?;
   Ok(())
}
