use anchor_lang::prelude::*;


// use state::Bank;     // First import State (Why we don't need to import state, maybe because they are the same level)
pub mod state;
pub mod error;       // Then register the mod state

use instructions::*;    // First import instructions
pub mod instructions;   // Then register the mod instructions

// This is your program's public key and it will update
// automatically when you build the project.
// declare_id!("Bz6FrjvxEwRegNYrSeeSZ3omynTP8d1xjSNr5wBNW7fK");
declare_id!("Ho5vdUND3M8RG7ztqJFVZDy834DcAqskuwxwcp2rjYac");

#[program]
mod lending {
    use super::*;
    pub fn init_bank(ctx: Context<InitBank>, liquidation_threshold: u64, max_ltv: u64, interest_rate: u64) -> Result<()> {
        process_init_bank(ctx, liquidation_threshold, max_ltv, interest_rate)
    }

    pub fn init_user(ctx: Context<InitUser>, usdc_address: Pubkey) -> Result<()> {
        process_init_user(ctx, usdc_address)
    }

    pub fn minter(ctx: Context<MintTokens>, quantity:u64) -> Result<()>{
        process_mint_tokens(ctx, quantity)
    }

    pub fn deposit(ctx:Context<Deposit>, amount:u64) -> Result<()> {
        process_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount:u64) -> Result<()> {
        process_withdraw(ctx, amount)
    }

}
