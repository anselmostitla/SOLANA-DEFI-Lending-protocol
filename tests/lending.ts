import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lending } from "../target/types/lending";


import { PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMint, TOKEN_PROGRAM_ID, mintTo, getOrCreateAssociatedTokenAccount, Account, createTransferInstruction, getAccount} from "@solana/spl-token";

const SOL_DECIMALS = 9;
const USDC_DECIMALS = 8;

describe("lending", () => {
  // Configure the client to use the local cluster.
  const pg = anchor.AnchorProvider.local()
  anchor.setProvider(pg);
  const program = anchor.workspace.Lending as Program<Lending>;
  

  // Get the payer (which will be the wallet used to pay fees and sign transactions)
  const payer = pg.wallet as anchor.Wallet;
  // Assume that the user is a different account (not the payer)
  const alice = anchor.web3.Keypair.generate(); // Create a new user

  
  let mintSol: anchor.web3.PublicKey;
  let mintUsdc: anchor.web3.PublicKey;

  let bankPda: anchor.web3.PublicKey;
  let bankTokenAccountPda: anchor.web3.PublicKey;
  
  let userAccountPda: anchor.web3.PublicKey;
  let userTokenAccountPda: anchor.web3.PublicKey;
  let payerAssociatedTokenAccount: Account;
  let aliceAssociatedTokenAccount: Account;
  let numTest: number = 0; // IMPORTANT: numTest is initialized in one block of curly braces and it will preserve its value in the other blocks {...}
  let transferTx;

  
  let liquidationThreshold = new anchor.BN(2);
  let maxLtv = new anchor.BN(1);

  [userAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [payer.publicKey.toBuffer()],
    program.programId
  );

  async function getOrInitBank(mint: PublicKey, bankPda: PublicKey, bankTokenAccountPda: PublicKey) {
    try {
      await program.account.bank.fetch(bankPda)
      console.log("Try init bank");
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
      console.log("catch init bank");
    }
  }

  async function getOrInitUser(mint: PublicKey) {
    try {
      await program.account.user.fetch(userAccountPda)
      console.log("Try init user");
    } catch (error) {
      await program.methods
      .initUser(mint)
      .accounts({
        signer: payer.publicKey,
        mint: mint,
        userAccount: userAccountPda,
        // userTokenAccount: payerAssociatedTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer.payer])
      .rpc()
      console.log("catch init user");
    }
  }

  async function deposit(mintToken:PublicKey) {
    const bankPda = getBankPda(mintToken);
    const bankTokenAccountPda = getBankTokenAccountPda(mintToken);
    const payerAssociatedTokenAccount = await getOrCreateATA(mintToken, payer);
    try {
      await program.methods
      .deposit(new anchor.BN(1))
      .accounts({
        signer: payer.publicKey,
        mint: mintToken,
        bank: bankPda,
        bankTokenAccount: bankTokenAccountPda,
        userAccount: userAccountPda,
        userTokenAccount: payerAssociatedTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer.payer])
      .rpc()
    } catch (error_code) {
      console.log("Deposit Error: ", error_code);
    }
  }

  function getBankPda(mint: PublicKey) {
    return anchor.web3.PublicKey.findProgramAddressSync(
      [mint.toBuffer()],
      program.programId
    );
  }

  function getBankTokenAccountPda(mint: PublicKey) {
    return anchor.web3.PublicKey.findProgramAddressSync( 
      [Buffer.from("treasury"), mint.toBuffer()],
      program.programId
    );
  }

  async function getOrCreateATA(mint: PublicKey, user: anchor.Wallet | anchor.web3.Keypair){
    return await getOrCreateAssociatedTokenAccount(
      pg.connection,
      payer.payer,
      mint,
      user.publicKey
    );
  }

  async function mintToAlice(mint: PublicKey) {
    return await mintTo(
      pg.connection, 
      payer.payer,  // payer
      mint,         // mint
      aliceAssociatedTokenAccount.address,  // destination
      payer.publicKey,  // authority
      10_000_000_000
    );
  }

  async function mintTokenToATA(mint: PublicKey, receiverATA: PublicKey) {
    return await mintTo(
      pg.connection, 
      payer.payer,  // payer
      mint,         // mint
      receiverATA, // aliceAssociatedTokenAccount.address,  // destination
      payer.publicKey,  // authority
      10_000_000_000
    );
  }

  async function transferMint(senderATA: PublicKey, receiverATA: PublicKey) {

    // 2) Now the tokens previously mint to alice will be transfer to our user "payer"
    transferTx = new Transaction().add(
      createTransferInstruction(
        senderATA, // aliceAssociatedTokenAccount.address, // Sender token account
        receiverATA, // payerAssociatedTokenAccount.address, // Receiver token account
        alice.publicKey, // Authority (signer)
        10_00_000_000, // Amount of tokens to transfer, remember our token has 9 decimals
        [], // Signers (optional if sender is signing the transaction)
        TOKEN_PROGRAM_ID // The token program ID
      )
    );
    // Send the transaction
    await sendAndConfirmTransaction(pg.connection, transferTx, [alice]);

    // const accountInfo = await getAccount(pg.connection, payerAssociatedTokenAccount.address);
    // console.log("Account info amount: ", accountInfo.amount);
  }

  async function createMintToken():Promise<anchor.web3.PublicKey> {
    const tokenMinted = await createMint(
      pg.connection, // connection
      payer.payer, // fee payer (pg.wallet.keypair)
      payer.publicKey, // mint authority and owner
      payer.publicKey, // freeze authority (you can use `null` to disable it. when you disable it, you can't turn it on again)
      9 // decimals
    )

    return tokenMinted
  }
  
  beforeEach(async() => {
    try {
      const balance = await pg.connection.getBalance(alice.publicKey)
      if (balance < 100_000_000_000) {
        // 1) Create a transaction to transfer SOL, from payer to Alice, so that Alice can pay for fees to transfer some spl tokens to our user payer
        const transferTransaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,  // Sender account (payer)
            toPubkey: alice.publicKey,        // Receiver account (Alice)
            lamports: 100_000_000_000,             // Amount in lamports (100 SOL = 100_000_000_000 lamports)
          })
        );
        // Send and confirm the transaction
        await sendAndConfirmTransaction(pg.connection, transferTransaction, [payer.payer]);      
      }
    } catch (error) {
        // 1) Create a transaction to transfer SOL, from payer to Alice, so that Alice can pay for fees to transfer some spl tokens to our user payer
        const transferTransaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,  // Sender account (payer)
            toPubkey: alice.publicKey,        // Receiver account (Alice)
            lamports: 100_000_000_000,             // Amount in lamports (100 SOL = 100_000_000_000 lamports)
          })
        );
        // Send and confirm the transaction
        await sendAndConfirmTransaction(pg.connection, transferTransaction, [payer.payer]);     
    }


    if (numTest == 0) {
      mintSol = await createMintToken();
      mintUsdc = await createMintToken();
      console.log("numTest: ", numTest);
      console.log("mintSol: ", mintSol.toBase58());
      console.log("mintUsdc: ", mintUsdc.toBase58()); 
    }

  })

  it("Init bank", async() => {
    numTest += 1;
    console.log("numTest: ", numTest);

    const mintToken = mintUsdc;
    console.log("mintUsdc: ", mintToken.toBase58());

    [bankPda] = getBankPda(mintToken);
    [bankTokenAccountPda] = getBankTokenAccountPda(mintToken);
    await getOrInitBank(mintToken, bankPda, bankTokenAccountPda);
  })

  it("Init user", async() => {
    numTest += 1;
    console.log("numTest: ", numTest);

    const mintToken = mintSol;
    console.log("mintSol: ", mintToken.toBase58());

    payerAssociatedTokenAccount = await getOrCreateATA(mintToken, payer)
    // await getOrInitUser(mintToken);

    // UNCOMMENT: To see how this part will fail since the "user" has already been created above
    await program.methods
    .initUser(mintToken)
    .accounts({
      signer: payer.publicKey,
      mint: mintToken,
      userAccount: userAccountPda,
      // userTokenAccount: payerAssociatedTokenAccount.address,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([payer.payer])
    .rpc()
  })
    
  it("Deposit usdc", async() => {
    numTest += 1;
    console.log("numTest: ", numTest);

    const mintToken = mintUsdc;
    console.log("mintUsdc: ", mintToken.toBase58());
    
    [bankPda] = getBankPda(mintToken);
    [bankTokenAccountPda] = getBankTokenAccountPda(mintToken);

    await getOrInitBank(mintToken, bankPda, bankTokenAccountPda);
    await getOrInitUser(mintToken); // MISTAKE: HERE WE ARE RETRIEVEN "INIT USER" WITH mintSol and not with the current token we are working, mintUsdc
    
    payerAssociatedTokenAccount = await getOrCreateATA(mintToken, payer) // extrange
    aliceAssociatedTokenAccount = await getOrCreateATA(mintToken, alice)
    
    // First mint to alice, then alice transfers her tokens minted to our main user, the "payer" user.
    // await mintToAlice(mintToken);
    await mintTokenToATA(mintToken, aliceAssociatedTokenAccount.address);
    await transferMint(aliceAssociatedTokenAccount.address, payerAssociatedTokenAccount.address);

    // Deposit
    // await deposit(mintToken);
    try {
      await program.methods
      .deposit(new anchor.BN(1))
      .accounts({
        signer: payer.publicKey,
        mint: mintToken,
        bank: bankPda,
        bankTokenAccount: bankTokenAccountPda,
        userAccount: userAccountPda,  // USING USER INDEPENDENT OF SOL OR USDC (THIS CAN BE A VULNERABILITY) [SHOULD WE MAKE DEPENDENT TO THE mintToken]
        userTokenAccount: payerAssociatedTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer.payer])
      .rpc()
    } catch (error) {
      console.log("Deposit error", error);
    }
  })

  it("Deposit sol", async() => {
    numTest += 1;
    console.log("numTest: ", numTest);

    const mintToken = mintSol;
    console.log("mintSol: ", mintToken.toBase58());
    
    [bankPda] = getBankPda(mintToken);
    [bankTokenAccountPda] = getBankTokenAccountPda(mintToken);

    await getOrInitBank(mintToken, bankPda, bankTokenAccountPda);
    await getOrInitUser(mintToken);
    
    payerAssociatedTokenAccount = await getOrCreateATA(mintToken, payer)
    aliceAssociatedTokenAccount = await getOrCreateATA(mintToken, alice)
    
    // First mint to alice, then alice transfers her tokens minted to our main user, the "payer" user.
    // await mintToAlice(mintToken, )
    await mintTokenToATA(mintToken, aliceAssociatedTokenAccount.address)
    await transferMint(aliceAssociatedTokenAccount.address, payerAssociatedTokenAccount.address);

    await deposit(mintToken);

  })

  it("Withdraw usdc", async() => {
    numTest += 1;
    console.log("numTest: ", numTest);

    const mintToken = mintUsdc;
    console.log("mintUsdc: ", mintToken.toBase58());

    [bankPda] = getBankPda(mintToken);
    [bankTokenAccountPda] = getBankTokenAccountPda(mintToken);

    payerAssociatedTokenAccount = await getOrCreateATA(mintToken, payer)
    aliceAssociatedTokenAccount = await getOrCreateATA(mintToken, alice)

    await getOrInitBank(mintToken, bankPda, bankTokenAccountPda);
    await getOrInitUser(mintToken);

    await mintTokenToATA(mintToken, aliceAssociatedTokenAccount.address)
    await transferMint(aliceAssociatedTokenAccount.address, payerAssociatedTokenAccount.address);

    await deposit(mintToken);

    await program.methods
      .withdraw(new anchor.BN(1))
      .accounts({
        signer: payer.publicKey,
        mint: mintToken,
        bank: bankPda,
        bankTokenAccount: bankTokenAccountPda,
        userAccount: userAccountPda,
        userTokenAccount: payerAssociatedTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payer.payer])
      .rpc()
  })

});
