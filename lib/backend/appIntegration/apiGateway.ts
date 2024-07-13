import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as aws_go_lambda from "@aws-cdk/aws-lambda-go-alpha";

interface Props {
    scope: Construct;
    name: string;
    functions: {
        name: string;
        function: aws_go_lambda.GoFunction;
    } [];
}

export function newMiddlewareGatewayAPI(props: Props) {
    
    // This should be automated eventually.
    const integrationSendMessageLambda = new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "idHttpLambdaIntegration".concat(props.functions[0].name), props.functions[0].function);
    const integrationGetChannelLambda = new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "idHttpLambdaIntegration".concat(props.functions[1].name), props.functions[1].function);
    const integrationCreateChannelLambda = new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "idHttpLambdaIntegration".concat(props.functions[2].name), props.functions[2].function);
    const integrationDeleteChannelLambda = new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "idHttpLambdaIntegration".concat(props.functions[3].name), props.functions[3].function);
    const integrationUpdateChannelLambda = new cdk.aws_apigatewayv2_integrations.HttpLambdaIntegration(
        "idHttpLambdaIntegration".concat(props.functions[4].name), props.functions[4].function);
    

    const newAPI = new cdk.aws_apigatewayv2.HttpApi(props.scope, "idHttpApi".concat(props.name));
    //Also should be automated.
    newAPI.addRoutes({
        path: "/sendMessage",
        methods: [cdk.aws_apigatewayv2.HttpMethod.POST],
        integration: integrationSendMessageLambda,
    });
    newAPI.addRoutes({
        path: "/getChannel",
        methods: [cdk.aws_apigatewayv2.HttpMethod.GET],
        integration: integrationGetChannelLambda,
    });
    newAPI.addRoutes({
        path: "/createChannel",
        methods: [cdk.aws_apigatewayv2.HttpMethod.POST],
        integration: integrationCreateChannelLambda,
    });
    newAPI.addRoutes({
        path: "/deleteChannel",
        methods: [cdk.aws_apigatewayv2.HttpMethod.POST],
        integration: integrationDeleteChannelLambda,
    });
    newAPI.addRoutes({
        path: "/updateChannel",
        methods: [cdk.aws_apigatewayv2.HttpMethod.POST],
        integration: integrationUpdateChannelLambda,
    });

    return {
        // Automate this as well.
        integrations: [integrationSendMessageLambda, integrationGetChannelLambda, integrationCreateChannelLambda, integrationDeleteChannelLambda, integrationUpdateChannelLambda],
        api: newAPI,
    };
}