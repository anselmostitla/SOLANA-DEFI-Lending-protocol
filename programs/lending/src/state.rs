use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Bank {
   pub authority: Pubkey, // Every bank should have an authority, who will have special permissions to change the config of the bank
   pub mint_address: Pubkey, // represents the address of the underlying asset
   pub total_deposits: u64,
   pub total_deposit_shares: u64,
   pub total_borrowed: u64,
   pub total_borrowed_shares: u64,
   pub liquidation_threshold: u64, // loan to value at which loan is defined as under collateralized and can be liquidated
   pub liquidation_bonus: u64, // percentage of the liquidation that is being send to the liquidator as a bonus for processing the liquidation
   pub liquidation_close_factor: u64, // percentage of collateral that can be liquidated
   pub max_ltv: u64, // max percentage of collateral that can be borrow
   pub last_updated: i64,
   pub interest_rate: u64,
}