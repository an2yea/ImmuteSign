import app from "../../output/app.json"
import { Model, Output } from "../types";

export function  getPostModelFromOutput() {
  return app.createDapp.streamIDs.find(
    (model) => model.name === `${app.createDapp.slug}_post`
  ) as Model;
}

export function getOutput(): Output {
  return app as Output;
}