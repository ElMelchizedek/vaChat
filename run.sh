#!/bin/bash

# Check if a parameter is provided
if [ -z "$1" ]; then
  echo "Usage: $0 {build|design}"
  exit 1
fi

# Handle the provided parameter
case "$1" in
  build)
    cd cdk
    cdk deploy --profile testing --all --require-approval never
    ;;
  design)
    cdk cdk
    cdk synth --profile testing --all
    ;;
  *)
    echo "Invalid option: $1"
    echo "Usage: $0 {build|design}"
    exit 1
    ;;
esac