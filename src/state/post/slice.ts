import { encryptWithLit, newLitKey } from "@/sdk/encryptionAndDecryption";
import { decryptFile, decryptPost as _decryptPost } from "@/sdk/folder";
import {
  collect,
  getDatatokenInfo as _getDatatokenInfo,
  isCollected,
} from "@/sdk/monetize";
import {
  createDatatokenPostStream,
  createPublicPostStream,
  generateAccessControlConditions,
  loadAllPostStreams,
  loadMyPostStreams,
} from "@/sdk/post";
import {
  CustomMirrorFile,
  LitKit,
  Post,
  PostContent,
  PostStream,
  PostType,
} from "@/types";
import { getAddressFromDid } from "@/utils/didAndAddress";
import { web3Storage } from "@/utils/web3Storage";
import { DecryptionConditionsTypes } from "@dataverse/runtime-connector";
import {
  createSlice,
  createAsyncThunk,
  PayloadAction,
  current,
} from "@reduxjs/toolkit";
import { Message } from "@arco-design/web-react";
import { connectIdentity } from "@/sdk/identity";
import { appName } from "@/sdk";

interface Props {
  isEncrypting?: boolean;
  encryptedContent?: string;
  isEncryptedSuccessfully?: boolean;
  litKit?: LitKit;
  isPublishingPost: boolean;
  postStreamList: PostStream[];
}

const initialState: Props = {
  isEncrypting: false,
  encryptedContent: "",
  isEncryptedSuccessfully: false,
  litKit: undefined,
  isPublishingPost: false,
  postStreamList: [],
};

export const encryptPost = createAsyncThunk(
  "post/encryptPost",
  async ({ did, postContent }: { did: string; postContent: PostContent }) => {
    const address = getAddressFromDid(did);

    const decryptionConditions = await generateAccessControlConditions({
      did,
      address,
    });

    const decryptionConditionsType =
      DecryptionConditionsTypes.AccessControlCondition;

    const litKit = await newLitKey({
      did,
      decryptionConditions,
      decryptionConditionsType,
    });

    const res = await encryptWithLit({
      did,
      contentToBeEncrypted: JSON.stringify(postContent),
      litKit,
    });

    return res;
  }
);

export const decryptPost = createAsyncThunk(
  "post/decryptPost",
  async ({ did, postStream }: { did: string; postStream: PostStream }) => {
    await connectIdentity();
    const res = await _decryptPost({
      did,
      postStream,
    });
    return res;
  }
);

export const buyPost = createAsyncThunk(
  "file/buyFile",
  async ({ did, postStream }: { did: string; postStream: PostStream }) => {
    await connectIdentity();
    const res = await isCollected({
      datatokenId: postStream.streamContent.datatokenId!,
      address: getAddressFromDid(did),
    });
    if (!res) {
      await collect({
        did,
        appName: appName,
        datatokenId: postStream.streamContent.datatokenId!,
        indexFileId: postStream.streamContent.indexFileId,
      });
    }
    const res2 = await _decryptPost({ did, postStream });
    return res2;
  }
);

export const uploadImg = createAsyncThunk(
  "post/uploadImg",
  async ({ files }: { files: File[] }): Promise<string[]> => {
    const imgCIDs = await Promise.all(
      files.map((file) => web3Storage.storeFiles([file]))
    );
    const imgUrls = imgCIDs.map((cid) => `https://${cid}.ipfs.dweb.link`);
    return imgUrls;
  }
);

export const publishPost = createAsyncThunk(
  "post/publishPost",
  async ({
    did,
    profileId,
    postContent,
  }: {
    did: string;
    profileId?: string;
    postContent: PostContent;
  }) => {
    await connectIdentity();
    const rootStore = await import("@/state/store");
    const { settings } = rootStore.default.store.getState().privacySettings;
    const { postType, currency, amount, collectLimit } = settings;

    const post = {
      postContent,
      createdAt: new Date().toISOString(),
      postType,
    } as Post;

    try {
      let res;
      if (postType === PostType.Public) {
        res = await createPublicPostStream({ did, post });
      } else if (postType === PostType.Private) {
        // res = await createPrivatePostStream({ did, content, litKit });
      } else {
        if (
          (postContent.images && postContent.images?.length > 0) ||
          (postContent.videos && postContent.videos?.length > 0)
        ) {
          post.options = {
            lockedImagesNum: postContent.images?.length ?? 0,
            lockedVideosNum: postContent.videos?.length ?? 0,
          };
        }
        res = await createDatatokenPostStream({
          did,
          post,
          profileId: profileId!,
          currency: currency!,
          amount: amount!,
          collectLimit: collectLimit!,
        });
      }
      return res;
    } catch (error: any) {
      (error?.message ?? error) &&
        Message.error((error?.message ?? error).slice(0, 100));
      throw error;
    }
  }
);

export const displayPostList = createAsyncThunk(
  "post/displayPostList",
  async () => {
    const res = await loadAllPostStreams();
    return res;
  }
);

export const getDatatokenInfo = createAsyncThunk(
  "post/getDatatokenInfo",
  async ({ address }: { address: string }) => {
    const res = await _getDatatokenInfo({
      address,
    });
    return res.dataToken;
  }
);

export const postSlice = createSlice({
  name: "post",
  initialState,
  reducers: {
    setIsPublishingPost: (state, action: PayloadAction<boolean>) => {
      state.isPublishingPost = action.payload;
    },
    clearEncryptedState: (state) => {
      state.encryptedContent = "";
      state.isEncryptedSuccessfully = false;
      state.litKit = undefined;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(displayPostList.fulfilled, (state, action) => {
      state.postStreamList = action.payload;
    });

    builder.addCase(encryptPost.pending, (state) => {
      state.isEncrypting = true;
      state.isEncryptedSuccessfully = false;
    });
    builder.addCase(encryptPost.fulfilled, (state, action) => {
      state.encryptedContent = action.payload.encryptedContent;
      state.litKit = action.payload.litKit;
      state.isEncrypting = false;
      state.isEncryptedSuccessfully = true;
    });
    builder.addCase(encryptPost.rejected, (state) => {
      state.isEncrypting = false;
      state.isEncryptedSuccessfully = false;
    });

    builder.addCase(uploadImg.pending, (state) => {
      state.isPublishingPost = true;
    });
    builder.addCase(uploadImg.fulfilled, (state, action) => {
      state.isPublishingPost = false;
    });
    builder.addCase(uploadImg.rejected, (state) => {
      state.isPublishingPost = false;
    });

    builder.addCase(publishPost.pending, (state) => {
      state.isPublishingPost = true;
    });
    // builder.addCase(publishPost.fulfilled, (state, action, ) => {
    //   state.isPublishingPost = false;
    // });
    builder.addCase(publishPost.rejected, (state) => {
      state.isPublishingPost = false;
    });

    //decryptPostListener
    builder.addCase(decryptPost.pending, (state, action) => {
      const postStreamList = JSON.parse(
        JSON.stringify(current(state.postStreamList))
      ) as PostStream[];
      postStreamList.find((postStream) => {
        if (postStream.streamId === action.meta.arg.postStream.streamId) {
          postStream = Object.assign(postStream, {
            ...action.meta.arg.postStream,
            isDecrypting: false,
            isDecryptedSuccessfully: true,
          });
        }
      });
      state.postStreamList = postStreamList;
    });
    builder.addCase(decryptPost.fulfilled, (state, action) => {
      const postStreamList = JSON.parse(
        JSON.stringify(current(state.postStreamList))
      ) as PostStream[];
      postStreamList.find((postStream) => {
        if (postStream.streamId === action.meta.arg.postStream.streamId) {
          postStream = Object.assign(postStream, {
            ...action.payload,
            isDecrypting: false,
            isDecryptedSuccessfully: true,
          });
        }
      });
      state.postStreamList = postStreamList;
    });
    builder.addCase(decryptPost.rejected, (state, action) => {
      const postStreamList = JSON.parse(
        JSON.stringify(current(state.postStreamList))
      ) as PostStream[];
      postStreamList.find((postStream) => {
        if (postStream.streamId === action.meta.arg.postStream.streamId) {
          postStream = Object.assign(postStream, {
            ...action.meta.arg.postStream,
            isDecrypting: false,
            isDecryptedSuccessfully: false,
          });
        }
      });
      state.postStreamList = postStreamList;
      action.error.message && Message.error(action.error.message.slice(0, 100));
    });

    //buyPostListener
    builder.addCase(buyPost.pending, (state, action) => {
      const postStreamList = JSON.parse(
        JSON.stringify(current(state.postStreamList))
      ) as PostStream[];
      postStreamList.find((postStream) => {
        if (postStream.streamId === action.meta.arg.postStream.streamId) {
          postStream = Object.assign(postStream, {
            ...action.meta.arg.postStream,
            isBuying: true,
          });
        }
      });
      state.postStreamList = postStreamList;
    });
    builder.addCase(buyPost.fulfilled, (state, action) => {
      const postStreamList = JSON.parse(
        JSON.stringify(current(state.postStreamList))
      ) as PostStream[];
      postStreamList.find((postStream) => {
        if (postStream.streamId === action.meta.arg.postStream.streamId) {
          postStream = Object.assign(postStream, {
            ...action.payload,
            isBuying: false,
            hasBoughtSuccessfully: true,
          });
        }
      });
      state.postStreamList = postStreamList;
    });
    builder.addCase(buyPost.rejected, (state, action) => {
      const postStreamList = JSON.parse(
        JSON.stringify(current(state.postStreamList))
      ) as PostStream[];
      postStreamList.find((postStream) => {
        if (postStream.streamId === action.meta.arg.postStream.streamId) {
          postStream = Object.assign(postStream, {
            ...action.meta.arg.postStream,
            isBuying: false,
            hasBoughtSuccessfully: false,
          });
        }
      });
      state.postStreamList = postStreamList;
      action.error.message && Message.error(action.error.message.slice(0, 100));
    });
    //getDatatokenInfo
    builder.addCase(getDatatokenInfo.pending, (state, action) => {
      const postStreamList = JSON.parse(
        JSON.stringify(current(state.postStreamList))
      ) as PostStream[];
      postStreamList.find((postStream) => {
        if (postStream.streamContent.datatokenId === action.meta.arg.address) {
          postStream = {
            ...postStream,
            isGettingDatatokenInfo: true,
          };
        }
      });
      state.postStreamList = postStreamList;
    });
    builder.addCase(getDatatokenInfo.fulfilled, (state, action) => {
      const postStreamList = JSON.parse(
        JSON.stringify(current(state.postStreamList))
      ) as PostStream[];
      postStreamList.find((postStream) => {
        if (postStream.streamContent.datatokenId === action.meta.arg.address) {
          postStream.streamContent.datatokenInfo = {
            ...postStream.streamContent.datatokenInfo,
            ...action.payload,
          };
          postStream = {
            ...postStream,
            isGettingDatatokenInfo: false,
            hasGotDatatokenInfo: true,
          };
        }
      });
      state.postStreamList = postStreamList;
    });

    builder.addCase(getDatatokenInfo.rejected, (state, action) => {
      const postStreamList = JSON.parse(
        JSON.stringify(current(state.postStreamList))
      ) as PostStream[];
      postStreamList.find((postStream) => {
        if (postStream.streamContent.datatokenId === action.meta.arg.address) {
          postStream = {
            ...postStream,
            isGettingDatatokenInfo: false,
            hasGotDatatokenInfo: true,
          };
        }
      });
      state.postStreamList = postStreamList;
    });
  },
});

export default postSlice.reducer;
