#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ProtoMessageTable, Containers, VPC } from "../lib/stackMain";

interface EnvProps {
  prod: boolean
};

class Set extends Construct {
  constructor(scope: Construct, id: string, props?: EnvProps) {
    super(scope, id);
      new ProtoMessageTable(this, "dynamo");
  }
}

const app = new cdk.App();
new Set(app, "dev");
