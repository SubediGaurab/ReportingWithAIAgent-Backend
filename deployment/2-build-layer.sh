#!/bin/bash
set -eo pipefail
rm -rf package
pip3 install --target package/python -r ../function/requirements.txt
