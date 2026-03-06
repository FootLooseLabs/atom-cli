#!/bin/bash
echo "Installing Atom CLI..."
sudo ./installer/preinstall.sh
npm i
sudo npm install -g .
sudo ./installer/postinstall.sh