// I understand "admin" is imported first and then it is registered here as mod in order to be used
pub use admin::*;
pub mod admin;

pub use deposit::*;
pub mod deposit;

pub use minter::*;
pub mod minter;

pub use withdraw::*;
pub mod withdraw;

