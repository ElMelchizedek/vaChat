#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DynamoStack } from '../lib/dynamo';

interface EnvProps {
  prod: boolean
};

class Set extends Construct {
  constructor(scope: Construct, id: string, props?: EnvProps) {
    super(scope, id);
      new DynamoStack(this, "dynamo");
  }
}

const app = new cdk.App();
new Set(app, "dev");
