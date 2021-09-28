#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { App, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PkgPipeline } from "../lib/pkg-pipeline";

const app = new App();
const name = "nodejs-pkg-pipeline";
class PipelineStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new PkgPipeline(this, "PkgPipeline", {
      name: id,
      repoDescription: "Node.js Package Pipeline Repository",
      codeArtifactNamespace: "@my-namespace",
      codeArtifactRepo: "my-repo",
      codeArtifactDomain: "my-domain",
    });
  }
}

new PipelineStack(app, name);
