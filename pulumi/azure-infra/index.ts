import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure-native";

const config = new pulumi.Config();
const sshPublicKey = config.require("sshPublicKey");

const resourceGroup = new azure.resources.ResourceGroup("synit-az-rg", {
  location: "EastUS",
});

const vnet = new azure.network.VirtualNetwork("synit-az-vnet", {
  resourceGroupName: resourceGroup.name,
  location: resourceGroup.location,
  addressSpace: {
    addressPrefixes: ["10.0.0.0/16"],
  },
});

const subnet = new azure.network.Subnet("synit-az-subnet", {
  resourceGroupName: resourceGroup.name,
  virtualNetworkName: vnet.name,
  addressPrefix: "10.0.1.0/24",
});

const publicIp = new azure.network.PublicIPAddress("synit-az-pip", {
  resourceGroupName: resourceGroup.name,
  location: resourceGroup.location,
  publicIPAllocationMethod: "Dynamic",
});

const nsg = new azure.network.NetworkSecurityGroup("synit-az-nsg", {
  resourceGroupName: resourceGroup.name,
  location: resourceGroup.location,
  securityRules: [
    {
      name: "SSH",
      priority: 1000,
      direction: "Inbound",
      access: "Allow",
      protocol: "Tcp",
      sourcePortRange: "*",
      destinationPortRange: "22",
      sourceAddressPrefix: "*",
      destinationAddressPrefix: "*",
    },
  ],
});

const nic = new azure.network.NetworkInterface("synit-az-nic", {
  resourceGroupName: resourceGroup.name,
  location: resourceGroup.location,
  ipConfigurations: [{
    name: "ipconfig",
    subnet: { id: subnet.id },
    privateIPAllocationMethod: "Dynamic",
    publicIPAddress: { id: publicIp.id },
  }],
  networkSecurityGroup: { id: nsg.id },
});

const vm = new azure.compute.VirtualMachine("synit-az-vm", {
  resourceGroupName: resourceGroup.name,
  location: resourceGroup.location,
  networkProfile: {
    networkInterfaces: [{ id: nic.id }],
  },
  hardwareProfile: {
    vmSize: "Standard_B1s",
  },
  osProfile: {
    computerName: "myvm",
    adminUsername: "azureuser",
    linuxConfiguration: {
      disablePasswordAuthentication: true,
      ssh: {
        publicKeys: [{
          path: "/home/azureuser/.ssh/authorized_keys",
          keyData: sshPublicKey,
        }],
      },
    },
  },
  storageProfile: {
    imageReference: {
      publisher: "Canonical",
      offer: "0001-com-ubuntu-server-jammy",
      sku: "22_04-lts-gen2",
      version: "latest",
    },
    osDisk: {
      name: "osdisk",
      createOption: "FromImage",
      managedDisk: {
        storageAccountType: "Standard_LRS", // HDD padrão (mais barato)
      },
    },
  },
});

export const vmId = vm.id;
export const publicIpAddress = publicIp.ipAddress;
export const resourceGroupName = resourceGroup.name;