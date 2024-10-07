import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract, ethers } from "ethers";
import { startOfMonth, addMonths } from "date-fns";
import { Token } from "../typechain-types";

/**
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployOwlCrowdsale: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
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

  const MAX_SUPPLY = "1000000";
  const PRICE = ethers.parseUnits("0.025", "ether");
  const DEADLINE = Math.floor(startOfMonth(addMonths(new Date(), 1)).getTime() / 1000);
  const MIN_CONTRIBUTIONS = "10";
  const MAX_CONTRIBUTIONS = "10000";

  const tokenContract = await hre.ethers.getContract<Token>("Token", deployer);

  await deploy("OwlCrowdsale", {
    from: deployer,
    // Contract constructor arguments
    args: [
      await tokenContract.getAddress(),
      PRICE,
      ethers.parseUnits(MAX_SUPPLY, "ether"),
      DEADLINE,
      ethers.parseUnits(MIN_CONTRIBUTIONS, "ether"),
      ethers.parseUnits(MAX_CONTRIBUTIONS, "ether"),
    ],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract to interact with it after deploying.
  const owlCrowdsaleContract = await hre.ethers.getContract<Contract>("OwlCrowdsale", deployer);
  await owlCrowdsaleContract.waitForDeployment();

  const owlCrowdsaleAddress = await owlCrowdsaleContract.getAddress();

  console.log(`Crowdsale deployed to: ${owlCrowdsaleAddress}\n`);

  const transaction = await tokenContract.transfer(owlCrowdsaleAddress, ethers.parseUnits(MAX_SUPPLY, "ether"));
  await transaction.wait();

  console.log(`$ Tokens transferred to Owl Crowdsale\n`);
};

export default deployOwlCrowdsale;

// e.g. yarn deploy --tags OwlCrowdsale
deployOwlCrowdsale.tags = ["OwlCrowdsale"];
