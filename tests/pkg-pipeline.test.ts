// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { App, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { PkgPipeline } from "../lib/pkg-pipeline";

test("PkgPipeline has resources", () => {
  const app = new App();
  // WHEN
  class TestStack extends Stack {
    constructor(scope: Construct, id: string) {
      super(scope, id);
      new PkgPipeline(this, "TestPkgPipeline", {
        name: "test",
        codeArtifactDomain: "test-domain",
        codeArtifactNamespace: "@test-namespace",
        codeArtifactRepo: "test-repo",
      });
    }
  }
  const stack = new TestStack(app, "TestStack");
  // THEN
  const template = app.synth().getStackArtifact(stack.artifactId).template;
  expect(template.Resources).toBeDefined();
});
