use anchor_lang::prelude::*;

#[account] 
#[derive(InitSpace)]   // Because an account takes up space on-chain we use InitSpace to calculate the space needed.
pub struct User { // This will be the structure to be able to initialized multiple user accounts for any user that comes to this application
   pub owner: Pubkey,
   pub deposited_sol: u64, 
   pub deposited_sol_shares: u64,
   pub borrowed_sol: u64,
   pub deposited_usdc: u64,
   pub deposited_usdc_shares: u64,
   pub borrowed_usdc: u64,
   pub usdc_address: Pubkey,
   pub last_updated: i64,
}

#[account]
#[derive(InitSpace)]
pub struct Bank {
   pub authority: Pubkey, // Every bank should have an authority, who will have special permissions to change the config of the bank
   pub mint_address: Pubkey, // represents the address of the asset
   pub total_deposits: u64,
   pub total_deposit_shares: u64,
   pub liquidation_threshold: u64, // loan to value a which loan is defined as under collateralized and can be liquidated
   pub liquidation_bonus: u64, // percentage of the liquidation that is being send to the liquidator as a bonus for processing the liquidation
   pub liquidation_close_factor: u64, // percentage of collateral that can be liquidated
   pub max_ltv: u64, // max percentage of collateral that can be borrow
   pub last_updated: i64,
}

// Since each user account can be liquidated we want to keep track of the liquidation threshold, the liquidation bonus, the close factor, and the maxltv.
// This constants are usually created base on the volatility of the asset, so they are going to be asset specific constants, so we are going to keep
// those in the bank of the asset

