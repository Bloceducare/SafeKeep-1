import { createAsyncThunk, createSlice, current } from "@reduxjs/toolkit";
import { request, gql } from "graphql-request";
import {
  getContractInstance,
  getSafeKeepContract,
} from "../../../config/constants/contractHelpers";
import {
  hideCreateVaultModal,
  hideDepositWithdrawalModal,
} from "../../../state/ui";
import { getSafeKeepAddress } from "../../../utils/addressHelper";
import {
  startApproving,
  endApproving,
  startDepositing,
  endDepositing,
  startWithdrawing,
  endWithdrawing,
} from "../../../state/shared";
import axios from "axios";
import revealEthErr from "../../../utils/revealEthErr";
import getOwner from "../../../utils/getOwner";
import toastify from "../../../utils/toast";
import tokenDetails from "../../../utils/tokenDetails";
import { tokenPrice } from "../../../services/moralis";
import {
  currentNetworkConfig,
  currrentChainId,
  graphqlEndpoint,
  simpleBackendEndpoint,
} from "../../../utils/networkConfig";
/* eslint-disable */

// -> Helper function specific here  update token data
const updateEtherBalance = (tokens, payload, type) => {
  const newAmount = Number(payload?.toString());
  let amount = tokens?.map((token) => {
    let amt =
      token.symbol === "ETH"
        ? type === "add"
          ? token.amount + newAmount
          : token.amount - newAmount
        : token.amount;
    return {
      ...token,
      amount: amt,
    };
  });
  return amount;
};

// -> Helper function specific here  update token data
const newTokenData = (wrapped, newDt, type) => {
  let tempArray = [];
  let tem = [];
  if (!newDt) return wrapped;
  for (let i = 0; i < newDt.length; i++) {
    const element = newDt[i];
    wrapped.forEach((ie) => {
      let ite = ie.address === element.token_address;
      if (ite) {
        return tem.push({
          ...ie,
          amount:
            type === "add"
              ? ie.amount + element.userTokenAmt
              : ie.amount - element.userTokenAmt,
        });
      } else {
        return tempArray.push(ie);
      }
    });

    return [...tempArray, ...tem];
  }

  wrapped = [...tempArray, ...tem];
  tempArray = [];
  tem = [];
  return true;
};

export const updateTokenPriceAsync = createAsyncThunk(
  "wallet/updateTokenPrice",
  async (_, { getState }) => {
    const state = getState();
    const tokenList = state.vault?.data?.tokens;
    let chain = `0x${Number(currrentChainId()).toString(16)}`;
    try {
      let result = await Promise.all(
        tokenList.map(async (x) => {
          let token = await tokenPrice({
            address: x?.address,
            chain,
          });
          return {
            ...x,
            price: token?.usdPrice,
          };
        })
      );

      return result;
    } catch (error) {
      // throw error;
    }
  }
);

export const getUserWalletAsset = createAsyncThunk(
  "wallet/getUserWalletAsset",
  async (payload) => {
    return payload;
  }
);

export const checkVaultIdAsync = createAsyncThunk(
  "vault/getVaultId",
  async (address) => {
    try {
      const contract = await getSafeKeepContract();

      const response = await contract.checkOwnerVault(address);
      return response.toString();
    } catch (error) {
      if (error?.code === "NETWORK_ERROR") throw error;
      throw error;
    }
  }
);

export const getNativeAsync = createAsyncThunk(
  "tokenPrice/getTokenPrice",
  async (data, { dispatch }) => {
    try {
      dispatch(hideCreateVaultModal());
    } catch (error) {
      console.log(error, "error");
    }
  }
);

export const getTokensHistoryAsync = createAsyncThunk(
  "tokenPrice/getTokensHistory",
  async (data) => {
    const { walletAddress, skip = 0 } = data;

    const tokensHistoryQuery = gql`
    {
      vaults(where: { owner: "${walletAddress}" }) {
        tokenTransactionHistory (first:10 skip:${skip}) {
          id 
          tokenAddress
          type 
          amount
          createdAt
         }
      }
    }
    `;

    try {
      const data =
        graphqlEndpoint() &&
        (await request(graphqlEndpoint(), tokensHistoryQuery));
      const info = data?.vaults[0]?.tokenTransactionHistory;
      if (!info) return [];

      try {
        const resultArray =
          info &&
          (await Promise.all(
            info
              .filter((i) => i.tokenAddress !== "0x00")
              .map(async (idx) => {
                const token = await tokenDetails(idx?.tokenAddress);
                return {
                  ...idx,
                  ...token,
                };
              })
          ));

        return resultArray;
      } catch (error) {
        console.log("fiet error", error);
        // emptyTokenData.push({
        //   ...result[i],
        //   tokens: [
        //     {
        //       id: "",
        //       amountAllocated: 0,
        //       symbol: "",
        //       name: "",
        //       decimals: "",
        //       address: result[i].id,
        //     },
        //   ],
        // });

        console.log(error, "error hee");
      }

      return info;
    } catch (error) {
      console.log("error occ plus", error);
    }
  }
);

export const getTokenHistoryAsync = createAsyncThunk(
  "tokenPrice/getTokenHistory",
  async (address) => {
    const tokenHistoryQuery = gql`
    {
      vaults(where: { owner: "${getOwner}" }) {
        tokens ( where:{id:"${address}"} first:10 skip:0) {
          id
          history {id type amount createdAt}
         }
      }
    }
    `;

    try {
      const data =
        graphqlEndpoint() &&
        (await request(graphqlEndpoint(), tokenHistoryQuery));
      if (!data?.vaults[0]?.tokens) return [];
      const results = await data.vaults[0].tokens;
      return results;
    } catch (error) {
      console.log("catch", error);
      throw error;
    }
  }
);

export const checkVaultAsync = createAsyncThunk(
  "vault/getUserVaultDetails",
  async (owner) => {
    const vaultQuery = gql`
      {
        vaults(where: { owner: "${owner}" }) {
          id
          StartingAmount
          owner
          totalEthAllocated
          inheritors {
            id
          }
          tokens {
            id
            amount
            allocated
          }
        }
      }
    `;

    try {
      const data =
        graphqlEndpoint() && (await request(graphqlEndpoint(), vaultQuery));
      if (!data?.vaults[0]) return [];

      const tokens =
        (await data.vaults[0]?.tokens.map((token) => token.id)) || [];
      const rawToken =
        (await data.vaults[0]?.tokens.map((token) => token)) || [];

      const tokensInfo = [];
      for (let i = 0; i < tokens.length; i++) {
        const details = await tokenDetails(tokens[i]);
        tokensInfo.push({
          amount: Number(rawToken[i].amount) ?? 0,
          token_address: tokens[i],
          balance: Number(rawToken[i].amount) ?? 0,
          allocated: Number(rawToken[i].allocated) ?? 0,
          ...details,
        });
      }
      const nativeToken = currentNetworkConfig();
      tokensInfo.push({
        address: nativeToken?.wrapped,
        symbol: nativeToken?.currencySymbol,
        name: nativeToken?.currencyName,
        amount: Number(data.vaults[0]?.StartingAmount),
        logo: nativeToken?.logo,
        decimals: nativeToken?.decimals,
        allocated: Number(data.vaults[0]?.totalEthAllocated),
        isNative: true,
      });
      const fullData = {
        id: data?.vaults[0]?.id ?? "",
        startingAmount: Number(data.vaults[0]?.StartingAmount) ?? 0,
        tokens: tokensInfo ?? [],
        backup: data.vaults[0]?.backup ?? "",
        owner: data.vaults[0]?.owner ?? "",
        inheritors: data.vaults[0]?.inheritors ?? [],
      };
      return fullData;
    } catch (error) {
      toastify("error", revealEthErr(error));
      console.log(error, "error gettting vault details");
      throw error;
    }
  }
);

export const createVaultAsync = createAsyncThunk(
  "vault/createVault",
  async (data, { dispatch, getState }) => {
    const contract = await getSafeKeepContract(true);

    const owner = getState().user.address;
    //dispatch an action to hide modal
    const { inheritors, _startingBal, _backupAddress, alias, walletAddress } =
      data;

    const payableAmount = _startingBal;

    try {
      const t = await contract.createVault(
        inheritors,
        _startingBal,
        _backupAddress,
        { value: payableAmount }
      );
      toastify("info", "vault created pending for confirmation");
      dispatch(hideCreateVaultModal());
      const aliasData = alias.map((item, idx) => {
        return {
          alias: item,
          address: inheritors[idx],
        };
      });

      try {
        await axios.post(`${simpleBackendEndpoint()}users/inheritors`, {
          data: aliasData,
          id: owner,
        });
      } catch (error) {
        toastify("error", "inheritor alias submission failed");

        console.log(error);
      }

      let confirm = await t.wait();
      toastify(
        "success",
        "vault created successfully 🚀",
        confirm.transactionHash
      );
      dispatch(checkVaultAsync(walletAddress));
      return true;
    } catch (error) {
      toastify("error", revealEthErr(error));
      console.log(error, "error");
    }
  }
);

export const depositERC20TokenAsync = createAsyncThunk(
  "vault/depositTokens",
  async (data, { dispatch, getState }) => {
    const contract = await getSafeKeepContract(true);
    const { _id, tokenDeps, _amounts, selectedAssets } = data;

    const abi = [
      "function approve(address _spender, uint256 _value) public returns (bool success)",
    ];

    const abiAllowance = [
      "function allowance(address _owner, address _spender) public view returns (uint256 remaining)",
    ];

    try {
      dispatch(startDepositing());
      for (let i = 0; i < tokenDeps.length; i++) {
        const contrAllowance = getContractInstance(tokenDeps[i], abiAllowance);
        const { vault } = getState(); //get vault owner address to check allowance
        const safeKeepContractAddress = getSafeKeepAddress();
        const allowance = await contrAllowance.allowance(
          vault.data.owner,
          safeKeepContractAddress
        );

        //convert allowwance to number
        const allowed = Number(allowance.toString());
        if (allowed <= 0) {
          dispatch(startApproving());
          //show approving to ui
          //dispatch approving txn
          const contr = getContractInstance(tokenDeps[i], abi);

          //try and catch to end all process if one tkoen is disapproved
          try {
            const approveTransaction = await contr.approve(
              safeKeepContractAddress,
              "1000000000000000000000000000000000000000000000000000000000000000"
            );
            const confirmApprove = await approveTransaction.wait();

            if (confirmApprove?.events[0]?.data?.toString()) {
              toastify(
                "success",
                "Approved successfully 🚀",
                confirmApprove.transactionHash
              );
            }

            dispatch(endApproving());
          } catch (error) {
            dispatch(endDepositing());
            return dispatch(endApproving());
          }
        }
      }

      const txn = await contract.depositTokens(_id, tokenDeps, _amounts);
      toastify("info", "depositing tokens pending for confirmation");
      dispatch(hideDepositWithdrawalModal());
      const despositConfirmation = await txn.wait();
      if (despositConfirmation?.events[0]?.data?.toString()) {
        toastify(
          "success",
          "Tokens deposit successful 🚀",
          despositConfirmation.transactionHash,
          10000
        );
      }
      let value = selectedAssets.map((i) => {
        return { ...i, userTokenAmt: Number(i.userTokenAmt) * 10 ** 18 };
      });
      dispatch(endDepositing());
      return value;
      // return dispatch(checkVaultAsync(_id));
    } catch (error) {
      dispatch(endDepositing());
      toastify("error", revealEthErr(error));
      //   toast.error(error.TokenDeposit);
      console.log(error, "error");
    }
  }
);

export const withdrawERC20TokenAsync = createAsyncThunk(
  "vault/withdrawTokens",
  async (data, { dispatch }) => {
    const contract = await getSafeKeepContract(true);
    const { _id, tokenDeps, _amounts, selectedAssets } = data;

    try {
      dispatch(startWithdrawing());
      const txn = await contract.withdrawTokens(_id, tokenDeps, _amounts);
      toastify("info", "withdrawing tokens pending for confirmation");
      dispatch(hideDepositWithdrawalModal());
      const despositConfirmation = await txn.wait();

      if (despositConfirmation?.events[0]?.data?.toString()) {
        toastify(
          "success",
          "tokens withdrawn successfully 🚀",
          despositConfirmation.transactionHash
        );
      }

      let value = selectedAssets.map((i) => {
        return { ...i, userTokenAmt: Number(i.userTokenAmt) * 10 ** 18 };
      });

      return value;
    } catch (error) {
      toastify("error", revealEthErr(error));

      console.log(error, "error");
    }
  }
);

export const depositEtherAsync = createAsyncThunk(
  "vault/depositEther",
  async (data, { dispatch }) => {
    const contract = await getSafeKeepContract(true);

    const { id, amount } = data;

    try {
      dispatch(startDepositing());
      const txn = await contract.depositEther(id, amount, { value: amount });
      toastify("info", "depositing ether pending for confirmation");
      dispatch(hideDepositWithdrawalModal());
      const despositConfirmation = await txn.wait();

      if (despositConfirmation?.events[0]?.data?.toString()) {
        toastify(
          "success",
          "deposit successful 🚀",
          despositConfirmation.transactionHash
        );
      }
      dispatch(endDepositing());
      return amount;
    } catch (error) {
      dispatch(endDepositing());
      toastify("error", revealEthErr(error));
      console.log(error, "error");
    }
  }
);
export const withdrawEtherAsync = createAsyncThunk(
  "vault/withdrawEther",
  async (data, { dispatch }) => {
    const contract = await getSafeKeepContract(true);

    const { id, amount } = data;

    try {
      dispatch(startWithdrawing());
      const txn = await contract.withdrawEth(id, amount);
      toastify("info", "withdrawing ether pending for confirmation");
      dispatch(hideDepositWithdrawalModal());
      const withdrawalConfirmation = await txn.wait();

      if (withdrawalConfirmation?.events[0]?.data?.toString()) {
        toastify(
          "success",
          "withdrawal successfull🚀",
          withdrawalConfirmation.transactionHash
        );
      }

      // dispatch(checkVaultAsync(id));
      dispatch(endWithdrawing());
      return amount;
    } catch (error) {
      dispatch(endWithdrawing());
      toastify("error", revealEthErr(error));
      console.log(error, "error");
    }
  }
);

export const vault = createSlice({
  name: "vault",
  initialState: {
    data: {
      id: "",
      startingAmount: 0,
      tokens: [],
      backup: "",
      owner: "",
      inheritors: [],
    },
    startingAmount: "",
    tokens: [],
    owner: "",
    inheritors: [],
    backup: "",
    status: null,
    error: null,
    crud: null,
    id: null,
    idError: null,
    receipt: null,
    createError: null,
    fetchError: null,
    loading: null,
    userAssets: [],
    creatingVault: null,
    tokensHistory: {
      data: [],
      loading: null,
      error: null,
      loaded: false,
      status: null,
    },
  },

  reducers: {
    clearCreateError: (state) => {
      state.createError = null;
    },
    clearFetchError: (state) => {
      state.fetchError = null;
    },
  },
  extraReducers: (builder) => {
    // Add reducers for additional action types here, and handle loading state as needed
    builder
      //create vault
      .addCase(createVaultAsync.pending, (state) => {
        state.creatingVault = true;
        state.createError = null;
        state.crud = true;
      })

      .addCase(createVaultAsync.fulfilled, (state, { payload }) => {
        //  state.receipt = payload;
        state.crud = false;
        state.creatingVault = false;
      })
      .addCase(createVaultAsync.rejected, (state, { payload }) => {
        state.createError = payload;
        state.creatingVault = false;
      })
      //deposit ether to vault
      .addCase(depositEtherAsync.pending, (state) => {
        state.crud = true;
      })
      .addCase(depositEtherAsync.fulfilled, (state, { payload }) => {
        const newAmount = Number(payload?.toString());
        if (payload) {
          state.data.tokens = updateEtherBalance(
            state.data.tokens,
            payload,
            "add"
          );
          state.data.startingAmount = state.data.startingAmount + newAmount;
        }
        state.crud = false;
      })
      .addCase(depositEtherAsync.rejected, (state, { payload }) => {
        state.crud = false;
      })
      //deposit tokens to vault
      .addCase(depositERC20TokenAsync.pending, (state) => {
        //  state.crud = true;
      })
      .addCase(depositERC20TokenAsync.fulfilled, (state, { payload }) => {
        state.data.tokens = newTokenData(
          current(state.data.tokens),
          payload,
          "add"
        );

        state.crud = false;
      })
      .addCase(depositERC20TokenAsync.rejected, (state, { payload }) => {
        //  state.crud = false;
      })

      //withdraw ether from vault
      .addCase(withdrawEtherAsync.pending, (state) => {
        state.crud = true;
      })
      .addCase(withdrawEtherAsync.fulfilled, (state, { payload }) => {
        const newAmount = Number(payload?.toString());
        if (payload) {
          state.data.tokens = updateEtherBalance(
            state.data.tokens,
            payload,
            "sub"
          );
          state.data.startingAmount = state.data.startingAmount - newAmount;
        }
        state.crud = false;
      })
      .addCase(withdrawEtherAsync.rejected, (state, { payload }) => {
        state.crud = false;
      })

      //withdraw tokens to vault
      .addCase(withdrawERC20TokenAsync.pending, (state) => {
        //  state.crud = true;
      })
      .addCase(withdrawERC20TokenAsync.fulfilled, (state, { payload }) => {
        state.data.tokens = newTokenData(state.data.tokens, payload, "minus");

        state.crud = false;
      })
      .addCase(withdrawERC20TokenAsync.rejected, (state, { payload }) => {
        //  state.crud = false;
      })

      .addCase(checkVaultAsync.pending, (state) => {
        state.fetchError = null;
        state.createError = null;
        state.loading = true;
      })
      .addCase(checkVaultAsync.fulfilled, (state, { payload }) => {
        state.loading = false;
        if (payload === "empty-data") {
          state.data = {
            id: "",
            startingAmount: 0,
            tokens: [],
            backup: "",
            owner: "",
            inheritors: [],
          };
        } else {
          state.data = payload;
        }
      })
      .addCase(checkVaultAsync.rejected, (state) => {
        state.loading = false;
        state.fetchError = true;
      })
      .addCase(updateTokenPriceAsync.fulfilled, (state, { payload }) => {
        if (payload) {
          state.data.tokens = payload;
        }
      })

      .addCase(getUserWalletAsset.fulfilled, (state, { payload }) => {
        state.userAssets = payload;
      })

      //vault id reducers
      .addCase(checkVaultIdAsync.pending, (state) => {
        // state.crud =true
      })
      .addCase(checkVaultIdAsync.fulfilled, (state, { payload }) => {
        state.id = payload;
      })
      .addCase(checkVaultIdAsync.rejected, (state, { payload }) => {
        state.idError = payload;
      })
      .addCase(getTokensHistoryAsync.pending, (state) => {
        state.tokensHistory.status = "pending";
        state.tokensHistory.error = false;
        if (!state.tokensHistory.loaded) {
          state.tokensHistory.loading = true;
        }
      })
      .addCase(getTokensHistoryAsync.fulfilled, (state, { payload }) => {
        state.tokensHistory.data = payload;
        state.tokensHistory.loading = false;
        state.tokensHistory.loaded = true;
        state.tokensHistory.status = "fulfilled";
      })
      .addCase(getTokensHistoryAsync.rejected, (state, { payload }) => {
        state.tokensHistory.loading = false;
        state.tokensHistory.status = "rejected";
        state.tokensHistory.error = true;
      });
  },
});

export const { clearCreateError } = vault.actions;
export default vault.reducer;
