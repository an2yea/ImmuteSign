import { oldAppVersion } from "@/sdk";
import { FileType } from "@dataverse/runtime-connector";
import { Secret, Image, ImgWrapper, ImageWrapperGrid } from "./styled";
import React, { useEffect, useState } from "react";
import { PostStream } from "@/types";
import question from "@/assets/icons/question.png";

export interface TextProps {
  postStream: PostStream;
}

const Images: React.FC<TextProps> = ({ postStream }) => {
  const [images, setImages] = useState<string[]>([]);
  const showImage = (postStream: PostStream) => {
    if (postStream.streamContent.appVersion === oldAppVersion) {
      return [];
    }
    if (postStream.streamContent.fileType === FileType.Public) {
      return postStream.streamContent.content?.images ?? [];
    }
    if (postStream.streamContent.fileType === FileType.Private) {
      if (postStream.hasUnlockedSuccessfully) {
        return postStream.streamContent.content?.images ?? [];
      }
      return (
        Array.from<string>({
          length: 1,
        }).fill("?") ?? []
      );
    }
    if (postStream.streamContent.fileType === FileType.Datatoken) {
      if (postStream.hasUnlockedSuccessfully) {
        return postStream.streamContent.content?.images ?? [];
      }
      return (
        Array.from<string>({
          length: 1,
        }).fill("?") ?? []
      );
    }
    return [];
  };
  useEffect(() => {
    if (postStream.isGettingDatatokenInfo) return;
    let nowImages = showImage(postStream);
    if (
      nowImages.length === 0 &&
      postStream.streamContent.fileType !== FileType.Public &&
      !postStream.hasUnlockedSuccessfully
    ) {
      nowImages = ["?"];
    }
    nowImages = Array.from(new Set(nowImages));
    setImages(nowImages);
  }, [postStream]);

  const CurrentImgWrapper = images.length < 4 ? ImgWrapper : ImageWrapperGrid;
  return (
    <CurrentImgWrapper>
      {images.map((image, index) => {
        if (image === "?") {
          return (
            <Image
              key={"image" + index}
              src={question}
              imgCount={images.length < 4 ? images.length : 1}
            />
          );
        } else {
          return (
            <Image
              key={"image" + index}
              imgCount={images.length < 4 ? images.length : 1}
              src={image}
            ></Image>
          );
        }
      })}
    </CurrentImgWrapper>
  );
};

export default Images;
