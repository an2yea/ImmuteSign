import { oldAppVersion } from "@/sdk";
import { FileType } from "@dataverse/runtime-connector";
import { TextWrapper } from "./styled";
import React from "react";
import { CustomMirrorFile, PostStream } from "@/types";

export interface TextProps {
  postStream: PostStream;
}

const Text: React.FC<TextProps> = ({ postStream }) => {
  const showContent = (postStream: PostStream) => {
    if (postStream.streamContent.appVersion === oldAppVersion) {
      return (postStream.streamContent.content as any)?.content;
    }
    if (postStream.streamContent.fileType === FileType.Public) {
      return postStream.streamContent.content.text;
    }
    if (postStream.streamContent.fileType === FileType.Private) {
      if (postStream.hasUnlockedSuccessfully) {
        return postStream.streamContent.content?.text;
      }
      return "";
    }
    if (postStream.streamContent.fileType === FileType.Datatoken) {
      if (postStream.hasUnlockedSuccessfully) {
        return postStream.streamContent.content?.text;
      }
      return "" as string;
    }
  };
  return <TextWrapper>{showContent(postStream)}</TextWrapper>;
};

export default Text;
