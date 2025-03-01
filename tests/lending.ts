import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lending } from "../target/types/lending";


import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMint, TOKEN_PROGRAM_ID, mintTo, getOrCreateAssociatedTokenAccount, Account, createTransferInstruction, getAccount} from "@solana/spl-token";



describe("lending", () => {
  // Configure the client to use the local cluster.
  const pg = anchor.AnchorProvider.local()
  anchor.setProvider(pg);

  const program = anchor.workspace.Lending as Program<Lending>;
  
  // Get the payer (which will be the wallet used to pay fees and sign transactions)
  const payer = pg.wallet as anchor.Wallet;

  // Assume that the user is a different account (not the payer)
  const alice = anchor.web3.Keypair.generate(); // Create a new user

  
  let mint: anchor.web3.PublicKey;
  let mintUsdc: anchor.web3.PublicKey;

  let bankPda: anchor.web3.PublicKey;
  let bankTokenAccountPda: anchor.web3.PublicKey;
  
  let userAccountPda: anchor.web3.PublicKey;
  // let userTokenAccountPda: anchor.web3.PublicKey;
  let payerAssociatedTokenAccount: Account;
  let aliceAssociatedTokenAccount: Account;

  
  let liquidationThreshold = new anchor.BN(2);
  let maxLtv = new anchor.BN(1);

  [userAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [payer.publicKey.toBuffer()],
    program.programId
  );

  async function getOrInitBank() {
    try {
      await program.account.bank.fetch(bankPda)
    } catch (error) {
      await program.methods
      .initBank(liquidationThreshold, maxLtv)
      .accounts({
        signer: payer.publicKey, 
        mint: mint,
        bank: bankPda,
        bankTokenAccount: bankTokenAccountPda, 
        tokenProgram: TOKEN_PROGRAM_ID,
        // systemProgram: program.programId
      })
      .signers([payer.payer])
      .rpc();
    }
  }

  async function getOrInitUser() {
    try {
      await program.account.user.fetch(payerAssociatedTokenAccount.address)
    } catch (error) {
      await program.methods
      .initUser(mintUsdc)
      .accounts({
        signer: payer.publicKey,
        mint: mint,
        userAccount: userAccountPda,
        // userTokenAccount: userTokenAccountPda,
        userTokenAccount: payerAssociatedTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer.payer])
      .rpc()
    }
  }
  
  beforeEach(async() => {

    // wsol
    mint = await createMint(
      pg.connection, // connection
      payer.payer, // fee payer (pg.wallet.keypair)
      payer.publicKey, // mint authority and owner
      payer.publicKey, // freeze authority (you can use `null` to disable it. when you disable it, you can't turn it on again)
      8 // decimals
    );

    // usdc
    mintUsdc = await createMint(
      pg.connection,
      payer.payer,
      pg.wallet.publicKey,
      null,
      8
    );

    payerAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      pg.connection,
      payer.payer,
      mint, // mint account
      payer.publicKey, // mint For
    );

    aliceAssociatedTokenAccount = await getOrCreateAssociatedTokenAccount(
      pg.connection,
      payer.payer,
      mint,
      alice.publicKey
    );

    const mintToAlice = await mintTo(
      pg.connection, 
      payer.payer,  // payer
      mint,         // mint
      aliceAssociatedTokenAccount.address,  // destination
      payer.publicKey,  // authority
      10_000_000_000
    );

    let accountInfo = await getAccount(pg.connection, aliceAssociatedTokenAccount.address);
    // console.log("Account info Alice amount: ", accountInfo.amount);

    // THEN WE WILL PERFORM SOME TRANSFERS... 

    // 1) Create a transaction to transfer SOL from payer to Alice
    const transferTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,  // Sender account (payer)
        toPubkey: alice.publicKey,        // Receiver account (Alice)
        lamports: 100_000_000_000,             // Amount in lamports (100 SOL = 100_000_000_000 lamports)
      })
    );
    // Send and confirm the transaction
    let signature = await sendAndConfirmTransaction(pg.connection, transferTransaction, [payer.payer]);

    // 2) Now the tokens previously mint to alice will be transfer to payer
    const transferTx = new Transaction().add(
      createTransferInstruction(
        aliceAssociatedTokenAccount.address, // Sender token account
        payerAssociatedTokenAccount.address, // Receiver token account
        alice.publicKey, // Authority (signer)
        10_00_000_000, // Amount of tokens to transfer, remember our token has 8 decimals
        [], // Signers (optional if sender is signing the transaction)
        TOKEN_PROGRAM_ID // The token program ID
      )
    );
    // Send the transaction
    signature = await sendAndConfirmTransaction(pg.connection, transferTx, [alice]);

    accountInfo = await getAccount(pg.connection, payerAssociatedTokenAccount.address);
    // console.log("Account info amount: ", accountInfo.amount);

    [bankPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [mint.toBuffer()],
      // [payer.publicKey.toBuffer()],
      program.programId
    );

    [bankTokenAccountPda] = anchor.web3.PublicKey.findProgramAddressSync( 
      [Buffer.from("treasury"), mint.toBuffer()],
      program.programId
    );
    
    getOrInitBank();

    getOrInitUser();

    
  })

  it("Init bank", async() => {
    getOrInitBank();
  })

  it("Init user", async() => {
    getOrInitUser();
  })
    
  it("Deposit", async() => {
    getOrInitBank();
    getOrInitUser();

    try {

      // Deposit
      await program.methods
      .deposit(new anchor.BN(1))
      .accounts({
        signer: payer.publicKey,
        mint: mint,
        bank: bankPda,
        bankTokenAccount: bankTokenAccountPda,
        userAccount: userAccountPda,
        userTokenAccount: payerAssociatedTokenAccount.address,
        // userTokenAccount: userTokenAccountPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer.payer])
      .rpc()
    } catch (error) {
      
    }
  })

});
