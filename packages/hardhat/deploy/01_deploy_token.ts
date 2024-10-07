import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployToken: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` which will fill DEPLOYER_PRIVATE_KEY
    with a random private key in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const NAME = "OWL Token";
  const SYMBOL = "OWL";
  const MAX_SUPPLY = "1000000";

  await deploy("Token", {
    from: deployer,
    // Contract constructor arguments
    args: [NAME, SYMBOL, MAX_SUPPLY],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const tokenContract = await hre.ethers.getContract<Contract>("Token", deployer);
  await tokenContract.waitForDeployment();
  console.log("👋 Token Deployed:", await tokenContract.getAddress());
};

export default deployToken;

// e.g. yarn deploy --tags Token
deployToken.tags = ["Token"];
