use anchor_lang::prelude::*;

#[error_code]
pub enum ErrCode {
   
   #[msg("InsufficientFunds.into()")]
   InsufficientFunds,

   #[msg("InsuficientSol.into()")]
   InsuficientSol,

   #[msg("InsufficientAmountToBorrow")]
   InsufficientAmountToBorrow,
}