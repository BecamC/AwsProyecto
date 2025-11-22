#!/bin/bash

# Script para verificar el estado de Step Functions

PEDIDO_ID=$1

if [ -z "$PEDIDO_ID" ]; then
    echo "❌ Uso: ./verificar-step-functions.sh <pedido_id>"
    echo "Ejemplo: ./verificar-step-functions.sh 8919cd67-4625-4216-9c7b-a5ed5b470057"
    exit 1
fi

echo "🔍 Verificando ejecuciones de Step Functions para pedido: $PEDIDO_ID"
echo "================================================================================"
echo ""

# Buscar ejecuciones que contengan el pedido_id
echo "📋 Ejecuciones encontradas:"
aws stepfunctions list-executions \
    --state-machine-arn "arn:aws:states:us-east-1:079902990209:stateMachine:FlujoProcesarPedido-dev" \
    --max-results 10 \
    --query "executions[?contains(input, '$PEDIDO_ID')].[executionArn,status,startDate]" \
    --output table

echo ""
echo "================================================================================"
echo "💡 Para ver detalles de una ejecución específica, usa:"
echo "   aws stepfunctions describe-execution --execution-arn <ARN>"
echo ""
echo "💡 Para ver el historial de una ejecución:"
echo "   aws stepfunctions get-execution-history --execution-arn <ARN>"

