#!/bin/bash

# Reusable strings
USAGE="Usage: $0 {deploy|synth|destroy} {profile} {layer}"

# Check if parameters are provided
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
	echo "$USAGE"
	exit 1
fi

# Assign parameters to variables
ACTION="$1"
PROFILE="$2"
LAYER="$3"


# Check if the third parameter is "backend"
if [ "$LAYER" == "backend" ]; then
    APP="npx ts-node bin/createBackend.ts"
    CONTEXT="@config/backendConfig.json"
elif [ "$LAYER" == "webserver" ]; then
    APP="npx ts-node bin/createWebserver.ts"
    CONTEXT="@config/webserverConfig.json"
else
    echo "Invalid layer: $LAYER"
    echo "$USAGE" 
    exit 1
fi

# Handle the provided parameters
case "$ACTION" in
  	deploy)
    	cdk deploy --app "$APP" --context "$CONTEXT" --profile "$PROFILE" --all --require-approval never
    	;;
  	synth)
    	cdk synth --profile "$PROFILE" --all
    	;;
	destroy)
	  	cdk destroy --app "$APP" --context "$CONTEXT" --profile "$PROFILE" --all --require-approval never --force
		;;
  	*)
    	echo "Invalid option: $ACTION"
    	echo "Usage: $0 {build|design} {profile} {backend}"
    	exit 1
    	;;
esac
