import { expect } from "chai";
import { ethers } from "hardhat";
import { startOfMonth, addMonths, subMonths } from "date-fns";
import { OwlCrowdsale, Token } from "../typechain-types";

const tokens = (n: number) => {
  return ethers.parseUnits(n.toString(), "ether");
};

const ether = tokens;

describe("OwlCrowdsale", () => {
  describe("Crowdsale Open", () => {
    let token: Token,
      crowdsale: OwlCrowdsale,
      deployer: any,
      user1: any,
      crowdsaleDeployedAddress: string,
      tokenDeployedAddress: string;

    beforeEach(async () => {
      const crowdsaleFactory = await ethers.getContractFactory("OwlCrowdsale");
      const tokenFactory = await ethers.getContractFactory("Token");

      token = (await tokenFactory.deploy("OWL Token", "OWL", "1000000")) as Token;
      await token.waitForDeployment();
      tokenDeployedAddress = await token.getAddress();

      const accounts = await ethers.getSigners();
      deployer = accounts[0];
      user1 = accounts[1];

      const deadline = Math.floor(startOfMonth(addMonths(new Date(), 1)).getTime() / 1000);
      crowdsale = (await crowdsaleFactory.deploy(
        tokenDeployedAddress,
        ether(1),
        "1000000",
        deadline,
        "10",
        "1000",
      )) as OwlCrowdsale;
      await crowdsale.waitForDeployment();
      crowdsaleDeployedAddress = await crowdsale.getAddress();

      const transaction = await token.connect(deployer).transfer(crowdsaleDeployedAddress, tokens(1000000));
      await transaction.wait();
    });

    describe("Deployment", () => {
      it("sends tokens to the Crowdsale contract", async () => {
        expect(await token.balanceOf(crowdsaleDeployedAddress)).to.equal(tokens(1000000));
      });

      it("returns the price", async () => {
        expect(await crowdsale.price()).to.equal(ether(1));
      });

      it("returns token address", async () => {
        expect(await crowdsale.token()).to.equal(tokenDeployedAddress);
      });
    });

    describe("Buying Tokens", () => {
      let transaction: any;
      const amount = tokens(10);

      describe("Success", () => {
        beforeEach(async () => {
          await crowdsale.connect(deployer).whitelistAddress(user1.address);
          transaction = await crowdsale.connect(user1).buyTokens(amount, { value: ether(10) });
          await transaction.wait();
        });

        it("transfers tokens", async () => {
          expect(await token.balanceOf(crowdsaleDeployedAddress)).to.equal(tokens(999990));
          expect(await token.balanceOf(user1.address)).to.equal(amount);
        });

        it("updates tokensSold", async () => {
          expect(await crowdsale.tokensSold()).to.equal(amount);
        });

        it("emits a buy event", async () => {
          // --> https://hardhat.org/hardhat-chai-matchers/docs/reference#.emit
          await expect(transaction).to.emit(crowdsale, "Buy").withArgs(amount, user1.address);
        });
      });

      describe("Failure", () => {
        beforeEach(async () => {
          await crowdsale.connect(deployer).whitelistAddress(user1.address);
        });

        it("rejects insufficient ETH", async () => {
          await expect(crowdsale.connect(user1).buyTokens(tokens(10), { value: 0 })).to.be.revertedWith(
            "Insufficient ETH",
          );
        });
      });

      describe("Failure whitelist", () => {
        it("rejects non-whitelist addresses", async () => {
          await expect(crowdsale.connect(user1).buyTokens(tokens(10), { value: 0 })).to.be.revertedWith(
            "Caller is not on the whitelist",
          );
        });
      });
    });

    describe("Minimum/Maximum Contributions", () => {
      beforeEach(async () => {
        await crowdsale.connect(deployer).whitelistAddress(user1.address);
      });

      describe("Success", () => {
        let transaction: any;
        const amount = tokens(10);
        it("transfers tokens", async () => {
          transaction = await crowdsale.connect(user1).buyTokens(amount, { value: ether(10) });
          await transaction.wait();
          expect(await token.balanceOf(crowdsaleDeployedAddress)).to.equal(tokens(999990));
          expect(await token.balanceOf(user1.address)).to.equal(amount);
        });
      });

      describe("Failure", () => {
        it("prevents below minimum contribution", async () => {
          await expect(crowdsale.connect(user1).buyTokens(tokens(9), { value: ether(9) })).to.be.revertedWith(
            "Tokens amount is below minimum required",
          );
        });
        it("prevents above maximum contribution", async () => {
          await expect(crowdsale.connect(user1).buyTokens(tokens(1001), { value: ether(1001) })).to.be.revertedWith(
            "Tokens amount is above maximum allowed",
          );
        });
      });
    });

    describe("Sending ETH", () => {
      let transaction: any;
      const amount = ether(10);

      describe("Success", () => {
        beforeEach(async () => {
          await crowdsale.connect(deployer).whitelistAddress(user1.address);
          transaction = await user1.sendTransaction({ to: crowdsaleDeployedAddress, value: amount });
          await transaction.wait();
        });

        it("updates contracts ether balance", async () => {
          expect(await ethers.provider.getBalance(crowdsaleDeployedAddress)).to.equal(amount);
        });

        it("updates user token balance", async () => {
          expect(await token.balanceOf(user1.address)).to.equal(amount);
        });
      });

      describe("Failure", () => {
        it("prevents non-whitelist from buying tokens via receive", async () => {
          expect(
            user1.sendTransaction({
              to: crowdsaleDeployedAddress,
              value: amount,
              gasLimit: 51000,
            }),
          ).to.be.reverted;
        });
      });
    });

    describe("Updating Price", () => {
      let transaction: any;
      const price = ether(2);

      describe("Success", () => {
        beforeEach(async () => {
          transaction = await crowdsale.connect(deployer).setPrice(ether(2));
          await transaction.wait();
        });

        it("updates the price", async () => {
          expect(await crowdsale.price()).to.equal(ether(2));
        });
      });

      describe("Failure", () => {
        it("prevents non-owner from updating price", async () => {
          await expect(crowdsale.connect(user1).setPrice(price)).to.be.reverted;
        });
      });
    });

    describe("Finalizing Sale", () => {
      let transaction: any;
      const amount = tokens(10);
      const value = ether(10);

      describe("Success", () => {
        beforeEach(async () => {
          await crowdsale.connect(deployer).whitelistAddress(user1.address);
          transaction = await crowdsale.connect(user1).buyTokens(amount, { value: value });
          await transaction.wait();

          transaction = await crowdsale.connect(deployer).finalize();
          await transaction.wait();
        });

        it("transfers remaining tokens to owner", async () => {
          expect(await token.balanceOf(crowdsaleDeployedAddress)).to.equal(0);
          expect(await token.balanceOf(deployer.address)).to.equal(tokens(999990));
        });

        it("transfers ETH balance to owner", async () => {
          expect(await ethers.provider.getBalance(crowdsaleDeployedAddress)).to.equal(0);
        });

        it("emits Finalize event", async () => {
          // --> https://hardhat.org/hardhat-chai-matchers/docs/reference#.emit
          await expect(transaction).to.emit(crowdsale, "Finalize").withArgs(amount, value);
        });
      });

      describe("Failure", () => {
        it("prevents non-owner from finalizing", async () => {
          await expect(crowdsale.connect(user1).finalize()).to.be.reverted;
        });
      });
    });

    describe("Managing a whitelist", () => {
      describe("Success", () => {
        it("owner can add user to whitelist", async () => {
          await crowdsale.connect(deployer).whitelistAddress(user1.address);
          expect(await crowdsale.whitelist(user1.address)).to.be.true;
        });
      });

      describe("Failure", () => {
        it("prevents non-owner from adding to whitelist", async () => {
          await expect(crowdsale.connect(user1).whitelistAddress(user1.address)).to.be.reverted;
        });
      });
    });
  });

  describe("Crowdsale Deadline", () => {
    describe("Success", () => {
      let token: Token,
        crowdsale: OwlCrowdsale,
        deployer: any,
        user1: any,
        crowdsaleDeployedAddress: string,
        tokenDeployedAddress: string;

      let transaction: any;
      const amount = tokens(10);
      const value = ether(10);

      beforeEach(async () => {
        const crowdsaleFactory = await ethers.getContractFactory("OwlCrowdsale");
        const tokenFactory = await ethers.getContractFactory("Token");

        token = (await tokenFactory.deploy("OWL Token", "OWL", "1000000")) as Token;
        await token.waitForDeployment();
        tokenDeployedAddress = await token.getAddress();

        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        user1 = accounts[1];

        const deadline = addMonths(new Date(), 1).getTime();
        crowdsale = (await crowdsaleFactory.deploy(
          tokenDeployedAddress,
          ether(1),
          "1000000",
          deadline,
          "10",
          "1000",
        )) as OwlCrowdsale;
        await crowdsale.waitForDeployment();
        crowdsaleDeployedAddress = await crowdsale.getAddress();

        const transaction = await token.connect(deployer).transfer(crowdsaleDeployedAddress, tokens(1000000));
        await transaction.wait();
        await crowdsale.connect(deployer).whitelistAddress(user1.address);
      });

      it("Can buy before the deadline", async () => {
        transaction = await crowdsale.connect(user1).buyTokens(amount, { value: value });
        await transaction.wait();
        expect(await ethers.provider.getBalance(crowdsaleDeployedAddress)).to.equal(amount);
      });
    });

    describe("Failure", () => {
      let token: Token,
        crowdsaleAfterDeadline: OwlCrowdsale,
        deployer: any,
        user1: any,
        crowdsaleDeployedAddress: string,
        tokenDeployedAddress: string;

      const amount = tokens(10);
      const value = ether(10);

      beforeEach(async () => {
        const crowdsaleFactory = await ethers.getContractFactory("OwlCrowdsale");
        const tokenFactory = await ethers.getContractFactory("Token");

        token = (await tokenFactory.deploy("OWL Token", "OWL", "1000000")) as Token;
        await token.waitForDeployment();
        tokenDeployedAddress = await token.getAddress();

        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        user1 = accounts[1];

        const deadline = Math.floor(startOfMonth(subMonths(new Date(), 1)).getTime() / 1000);
        crowdsaleAfterDeadline = (await crowdsaleFactory.deploy(
          tokenDeployedAddress,
          ether(1),
          "1000000",
          deadline,
          "10",
          "1000",
        )) as OwlCrowdsale;
        await crowdsaleAfterDeadline.waitForDeployment();
        crowdsaleDeployedAddress = await crowdsaleAfterDeadline.getAddress();

        const transaction = await token.connect(deployer).transfer(crowdsaleDeployedAddress, tokens(1000000));
        await transaction.wait();
        await crowdsaleAfterDeadline.connect(deployer).whitelistAddress(user1.address);
      });

      it("prevents user from buying tokens after deadline", async () => {
        await expect(crowdsaleAfterDeadline.connect(user1).buyTokens(amount, { value })).to.be.revertedWith(
          "The crowdsale is closed",
        );
      });

      it("prevents user from buying tokens after deadline via receive", async () => {
        await expect(
          user1.sendTransaction({
            to: crowdsaleDeployedAddress,
            value: amount,
            gasLimit: 51000,
          }),
        ).to.be.reverted;
      });
    });
  });
});
