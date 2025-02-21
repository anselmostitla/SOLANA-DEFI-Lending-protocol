import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lending } from "../target/types/lending";



import { createMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { min } from "bn.js";

describe("lending", () => {
  // Configure the client to use the local cluster.
  const pg = anchor.AnchorProvider.local()
  anchor.setProvider(pg);

  const program = anchor.workspace.Lending as Program<Lending>;

  async function signer() {
    const signer = anchor.web3.Keypair.generate()

    const airdropSignature = await pg.connection.requestAirdrop(
      signer.publicKey,
      10*anchor.web3.LAMPORTS_PER_SOL
    )
    await pg.connection.confirmTransaction(airdropSignature)
    console.log(await pg.connection.getBalance(signer.publicKey));

    return signer;
  }
  
  

  let mint: anchor.web3.PublicKey
  let mintUSDC: anchor.web3.PublicKey
  let signer1

  beforeEach(async() => {
    signer1 = await signer()

    mint = await createMint(
      pg.connection, // connection
      signer1, // fee payer (pg.wallet.keypair)
      pg.wallet.publicKey, // mint authority
      pg.wallet.publicKey, // freeze authority (you can use `null` to disable it. when you disable it, you can't turn it on again)
      8 // decimals
    );

    mintUSDC = await createMint(
      pg.connection, // Client object that interacts with the Solana network
      signer1, // fee payer
      pg.wallet.publicKey, // mint authority
      pg.wallet.publicKey, // freeze authority (you can use `null` to disable it. when you disable it, you can't turn it on again)
      2 // decimals
    );
    
  })

  it("Init bank", async () => {

    const liquidationThreshold = new anchor.BN(2)
    const maxLtv = new anchor.BN(1)

    await program.methods
    .initBank(liquidationThreshold, maxLtv)
    .accounts({
      mint: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
    console.log("Created bankPda....")

    const [bankPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [mint.toBuffer()],
      program.programId
    )

    const bankFetch = await program.account.bank.fetch(bankPda)
    console.log("liquidationThreshold: ", bankFetch.liquidationThreshold);
    console.log("maxLtv: ", bankFetch.maxLtv);
  });

  it("Init user", async() => {

    await program.methods
      .initUser(mintUSDC)
      .accounts({
      })
      .rpc()

    const [userPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [pg.wallet.publicKey.toBuffer()],
      program.programId
    )

    const userFetch = await program.account.user.fetch(userPda)
    console.log("userFetch", userFetch)
  })
});
