import * as anchor from "@coral-xyz/anchor";
import { Lending } from "../target/types/lending";
import { BankrunProvider } from "anchor-bankrun";
import { expect } from "chai";

import {
   AccountInfoBytes, AddedAccount, BanksClient, BanksTransactionMeta, BanksTransactionResultWithMeta, ProgramTestContext, startAnchor
} from "solana-bankrun";

import {
   createAccount, createMint, mintTo, createAssociatedTokenAccount
} from "spl-token-bankrun";

import {
   Connection, PublicKey, Keypair, Transaction, TransactionInstruction, clusterApiUrl, Signer,
   LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";

// import {
//    getOrCreateAssociatedTokenAccount,
//    // createMint, mintTo, getOrCreateAssociatedTokenAccount, Account, createTransferInstruction, 
//    TOKEN_PROGRAM_ID 
// } from "@solana/spl-token";

import * as token from "@solana/spl-token"

const IDL = require("../target/idl/lending.json");

// Constants
const PROJECT_DIRECTORY = ""; // Leave empty if using default anchor project
const USDC_DECIMALS = 6;
const USDC_MINT_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // public key that represents the program that creates or "mints" a token, like USDC
const MINIMUM_SLOT = 100;
const MINIMUM_USDC_BALANCE = 100_000_000_000; // 100k USDC

// Create a new connection object ()
const networks = ['http://localhost:8899', clusterApiUrl('testnet'), 'https://api.devnet.solana.com', 'mainnet-beta']
const connection = new Connection((networks[0]), 'confirmed');

// ---------- Some utility functions that bankrun doesn't contain ---------- (https://github.com/ochaloup/spl-token-bankrun/blob/main/README.md)
async function createAssociatedTokenAccount(
   banksClient: BanksClient,
   payer: Signer,
   mint: PublicKey,
   owner: PublicKey,
   programId = token.TOKEN_PROGRAM_ID,
   associatedTokenProgramId = token.ASSOCIATED_TOKEN_PROGRAM_ID
 ): Promise<PublicKey> {
   const associatedToken = token.getAssociatedTokenAddressSync(
     mint,
     owner,
     true,
     programId,
     associatedTokenProgramId
   );
 
   const tx = new Transaction().add(
     token.createAssociatedTokenAccountInstruction(
       payer.publicKey,
       associatedToken,
       owner,
       mint,
       programId,
       associatedTokenProgramId
     )
   );
 
   [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
   tx.sign(payer);
 
   await banksClient.processTransaction(tx);
 
   return associatedToken;
 }

 async function mintTo(
   banksClient: BanksClient,
   payer: Signer,
   mint: PublicKey,
   destination: PublicKey,
   authority: Signer | PublicKey,
   amount: number | bigint,
   multiSigners: Signer[] = [],
   programId = token.TOKEN_PROGRAM_ID
 ): Promise<BanksTransactionMeta> {
   const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
 
   const tx = new Transaction().add(
     token.createMintToInstruction(
       mint,
       destination,
       authorityPublicKey,
       amount,
       multiSigners,
       programId
     )
   );
   [tx.recentBlockhash] = (await banksClient.getLatestBlockhash())!;
   tx.sign(payer, ...signers);
 
   return await banksClient.processTransaction(tx);
 }

 function getSigners(
   signerOrMultisig: Signer | PublicKey,
   multiSigners: Signer[]
 ): [PublicKey, Signer[]] {
   return signerOrMultisig instanceof PublicKey
     ? [signerOrMultisig, multiSigners]
     : [signerOrMultisig.publicKey, [signerOrMultisig]];
 }


describe("Bankrun Lending", () => {
   // Boiler plate variables (types definitions)
   let context: ProgramTestContext;
   let provider: BankrunProvider;
   let program: anchor.Program<Lending>;
   let banksClient: BanksClient;

   let payer: anchor.web3.Keypair;
   let mintSol: anchor.web3.PublicKey;
   let mintUsdc: anchor.web3.PublicKey;
   let solBankPda: anchor.web3.PublicKey;
   let usdcBankPda: anchor.web3.PublicKey;
   let solBankTokenAccountPda: anchor.web3.PublicKey;
   let usdcBankTokenAccountPda: anchor.web3.PublicKey;
   let userAccountPda: anchor.web3.PublicKey;
   let userPda: anchor.web3.PublicKey;

   // Input params
   let liquidationThreshold = new anchor.BN(2);
   let maxLtv = new anchor.BN(1);
   let interest_rate = new anchor.BN(5); // 5%
   let amount = 100_000;
   let amountBN = new anchor.BN(amount)

   let numTest = 0

   // converting the USDC_MINT_ADDRESS string into a PublicKey object by using the PublicKey class of Solana's JavaScript SDK
   // let usdcMint = new PublicKey(USDC_MINT_ADDRESS);

   // ---------- Some utility functions ----------
   async function getBankPda(mint: anchor.web3.PublicKey, pdaType: string): Promise<anchor.web3.PublicKey> {
      let seeds = [mint.toBuffer()];
      if(pdaType == "bankTokenAccountPda") {
         seeds = [Buffer.from("treasury"), mint.toBuffer()]
      }
      const [pdaAccount] = anchor.web3.PublicKey.findProgramAddressSync(
         seeds,
         program.programId
      );
      console.log(pdaType, pdaAccount.toBase58());
      return pdaAccount;
   }

   function getUserPda(): anchor.web3.PublicKey {
      const [pdaAccount] = anchor.web3.PublicKey.findProgramAddressSync(
         [payer.publicKey.toBuffer()],
         program.programId
      );
      console.log("userPda in getUserPda(): ", pdaAccount);
      return pdaAccount;
   }


   before(async() => {
      /***** Boiler plate variables (assign values) *****/
      context = await startAnchor(PROJECT_DIRECTORY, [], []);
      provider = new BankrunProvider(context);
      anchor.setProvider(provider);
      program = new anchor.Program<Lending>(IDL as Lending, provider);
      banksClient = context.banksClient;
   
      payer = provider.wallet.payer;   // richPerson = Keypair.generate();
      console.log("payer: ", payer.publicKey.toBase58());

      // let usdcAccount: AccountInfoBytes;
      // usdcAccount = await banksClient.getAccount(usdcMint);    
      // console.log("usdcAccount: ", usdcAccount);
      
      /***** Create mints *****/
      mintSol = await createMint(
         banksClient, // connection
         payer, // fee payer (pg.wallet.keypair)
         payer.publicKey, // mint authority and owner
         payer.publicKey, // freeze authority (you can use `null` to disable it. when you disable it, you can't turn it on again)
         9 // decimals
      );
      console.log("mintSol: ", mintSol.toBase58());

      mintUsdc = await createMint(
         banksClient,
         payer,
         payer.publicKey,
         payer.publicKey,
         6
      )
      console.log("mintUsdc: ", mintUsdc.toBase58());

      
      /***** Derive PDAs *****/


   })

   beforeEach(async() => {
      console.log("\n-------------------------");
   })

   it("Init Bank with mintSol", async() => {
      const mint = mintSol;
      const bankAccountPda = await getBankPda(mint, "bankAccountPda");
      const bankTokenAccountPda = await getBankPda(mint, "bankTokenAccountPda");
      await program.methods
         .initBank(liquidationThreshold, maxLtv, interest_rate)
         .accounts({
            signer: payer.publicKey, 
            mint: mint,
            bank: bankAccountPda,
            bankTokenAccount: bankTokenAccountPda, 
            tokenProgram: token.TOKEN_PROGRAM_ID,
         })
         .signers([payer])
         .rpc();

      const bankInfo = await program.account.bank.fetch(bankAccountPda)
      expect(bankInfo.liquidationThreshold.toNumber()).to.be.equal(liquidationThreshold.toNumber());
      expect(bankInfo.maxLtv.toNumber()).to.be.equal(maxLtv.toNumber());
      expect(bankInfo.interestRate.toNumber()).to.be.equal(interest_rate.toNumber())
   })

   it("Init Bank with mintUsdc", async() => {
      const mint = mintUsdc;
      const bankAccountPda = await getBankPda(mint, "bankAccountPda");
      const bankTokenAccountPda = await getBankPda(mint, "bankTokenAccountPda");
      await program.methods
         .initBank(liquidationThreshold, maxLtv, interest_rate)
         .accounts({
            signer: payer.publicKey,
            mint: mint,
            bank: bankAccountPda,
            bankTokenAccount: bankTokenAccountPda,
            tokenProgram: token.TOKEN_PROGRAM_ID,
         })
         .signers([payer])
         .rpc()
   })

   it("Init user with mintUsdc", async() => {
      const mint = mintUsdc
      const userAccountPda = getUserPda();
      await program.methods
         .initUser(mint)
         .accounts({
            signer: payer.publicKey,
            mint: mint, // q Thinking in business logic, is it neccessary to include mint account to initialized user
            userAccount: userAccountPda,
            tokenProgram: token.TOKEN_PROGRAM_ID,
         })
         .signers([payer])
         .rpc()
      const userInfo = await program.account.user.fetch(userAccountPda)
      expect(userInfo.owner.toBase58()).to.be.equal(payer.publicKey.toBase58())
      expect(userInfo.usdcAddress.toBase58()).to.be.equal(mintUsdc.toBase58())
   })

   it("Deposit mintUsdc", async() => {
      const mint = mintUsdc;
      const bankAccountPda = await getBankPda(mint, "bankAccountPda");
      const bankTokenAccountPda = await getBankPda(mint, "bankTokenAccountPda");
      const userAccountPda = getUserPda();
      const userAssociatedTokenAccount = await createAssociatedTokenAccount(banksClient, payer, mint, payer.publicKey);
      await mintTo(
         banksClient,
         payer,
         mint,
         userAssociatedTokenAccount, // destination: 
         payer, // authority: Signer | PublicKey,
         amount, // amount: number | bigint,
       )
      await program.methods
         .deposit(amountBN)
         .accounts({
            signer: payer.publicKey,
            mint: mint,
            bank: bankAccountPda,
            bankTokenAccount: bankTokenAccountPda,
            userAccount: userAccountPda,
            userTokenAccount: userAssociatedTokenAccount,
            tokenProgram: token.TOKEN_PROGRAM_ID,
         })
         .signers([payer])
         .rpc()
   })

   it("Deposit mintSol", async() => {
      const mint = mintSol;
      const bankAccountPda = await getBankPda(mint, "bankAccountPda");
      const bankTokenAccountPda = await getBankPda(mint, "bankTokenAccountPda");
      const userAccountPda = getUserPda();
      const userAssociatedTokenAccount = await createAssociatedTokenAccount(banksClient, payer, mint, payer.publicKey);
      await mintTo(
         banksClient,
         payer,
         mint,
         userAssociatedTokenAccount, // destination: 
         payer, // authority: Signer | PublicKey,
         amount, // amount: number | bigint,
       )
      await program.methods
         .deposit(amountBN)
         .accounts({
            signer: payer.publicKey,
            mint: mint,
            bank: bankAccountPda,
            bankTokenAccount: bankTokenAccountPda,
            userAccount: userAccountPda,
            userTokenAccount: userAssociatedTokenAccount,
            tokenProgram: token.TOKEN_PROGRAM_ID,
         })
         .signers([payer])
         .rpc()
   })



})