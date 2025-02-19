use anchor_lang::prelude::*;

declare_id!("Ho5vdUND3M8RG7ztqJFVZDy834DcAqskuwxwcp2rjYac");

#[program]
pub mod lending {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
