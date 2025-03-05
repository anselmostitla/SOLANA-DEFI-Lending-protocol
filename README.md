### To run this md file 
```shell
ctrl + shift + p + Markdown: Open Preview
```

# Lending protocol of two assets: SOL and USDC.

A lender will be able to deposit and withdraw, and a borrower will be able to borrow and repay assets on the lending protocol.

Accounts will be over-collateralized, this means we will need to calculate the health factor of the account, which makes an account
susceptible of liquidation.

If the account falls below the health factor, then it will be in risk of liquidation.

# Instruction

The instructios for this solana program will be: deposit, withdraw, borrow, repay, liquidate and set up accounts.

# Accounts 

We will have Bank accounts for each asset that we want on the lending protocol.
And User account.

# Project Setup and Installation Guide

This guide explains the commands required to set up and install dependencies for your project.

### Initialize a New Project (create the workspace)
```shell
anchor init lending && cd lending
```

### Check anchor project was setup correctly
```shell
a) anchor build
```

### update to "version = 3" in Cargo.lock (checking continuation)
```shell
b) sed -i "s/^version = 4$/version = 3/" Cargo.lock
```

### Compile project again (checking continuation)
```shell
anchor build
```

### 3. Add to Anchor.toml (checking continuation)
```shell
[test]
startup_wait = 100000

echo -e "\n[test]\nstartup_wait = 100000"
```

### Use node 18 (checking continuation)
```shell
nvm use node 18
```

### Finally test the anchor project  (checking continuation)
```shell
anchor test
```

### 5.  To add our spl-token in the Cargo.toml (internal)
```shell
cargo add anchor-spl
```

### 6.  Also update in Cargo.toml (internal) to the following
```shell
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
```

### 7. update to include the feature init_if_needed
```shell
cargo add anchor-lang --features init-if-needed
```


