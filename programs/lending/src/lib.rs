use anchor_lang::prelude::*;


// use state::Bank;     // First import State (Why we don't need to import state, maybe because they are the same level)
pub mod state;       // Then register the mod state

use instructions::*;    // First import instructions
pub mod instructions;   // Then register the mod instructions

// This is your program's public key and it will update
// automatically when you build the project.
// declare_id!("Bz6FrjvxEwRegNYrSeeSZ3omynTP8d1xjSNr5wBNW7fK");
declare_id!("Ho5vdUND3M8RG7ztqJFVZDy834DcAqskuwxwcp2rjYac");

#[program]
mod lending {
    use super::*;
    pub fn init_bank(ctx: Context<InitBank>, liquidation_threshold: u64, max_ltv: u64) -> Result<()> {
        process_init_bank(ctx, liquidation_threshold, max_ltv)
    }

}
