#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LpdeCdkStack } from '../lib/lpde-cdk-stack';
import { Tags } from '@aws-cdk/core';

const app = new cdk.App();
const innominataDemo = new LpdeCdkStack(app, 'InnominataDemo');
Tags.of(innominataDemo).add('activity', 'presales');
Tags.of(innominataDemo).add('customer', 'Innominata');
