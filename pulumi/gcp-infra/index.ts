import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

// Configurações customizadas (namespace do projeto ou sem namespace)
const config = new pulumi.Config();
const sshPublicKey = config.require("sshPublicKey");
const sshUser = sshPublicKey.split(' ').pop()?.split('@')[0] || "ubuntu";

// Configurações do provider GCP
const gcpConfig = new pulumi.Config('gcp');
const project = gcpConfig.require("project");
const region = gcpConfig.get("region") || "us-central1"; // us-central1/us-west1/us-east1

// 1. VPC Network
const vcn = new gcp.compute.Network("synit-gpc-free-vpc", {
  autoCreateSubnetworks: false,
});

// 2. Subnet
const subnet = new gcp.compute.Subnetwork("synit-gpc-free-subnet", {
  ipCidrRange: "10.0.1.0/24",
  region,
  network: vcn.id,
});

// 3. Firewall
const firewall = new gcp.compute.Firewall("synit-gpc-free-firewall", {
  network: vcn.id,
  allows: [
    { protocol: "tcp", ports: ["22", "80", "443"] },
  ],
  sourceRanges: ["0.0.0.0/0"],
});

// 5. VM Instance e2-micro
const vmInstance = new gcp.compute.Instance("synit-gpc-free-vm", {
  machineType: "e2-micro",
  zone: "us-central1-a",
  bootDisk: {
    initializeParams: {
      image: "ubuntu-os-cloud/ubuntu-2204-lts",
      size: 30,
      type: "pd-standard",
    },
  },
  networkInterfaces: [{
    network: vcn.id,
    subnetwork: subnet.id,
    accessConfigs: [{}],
  }],
  metadata: {
    "ssh-keys": `${sshUser}:${sshPublicKey}`,
    "startup-script": `#!/bin/bash
    # Criar swap de 4GB
    if [ ! -f /swapfile ]; then
        fallocate -l 4G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi

    # Opcional: Instalar Docker
    # apt-get update && apt-get install -y docker.io
`,
  },
  scheduling: {
    preemptible: false,
    automaticRestart: true,
    onHostMaintenance: "MIGRATE",
  },
  tags: ["http-server", "https-server"],
});

// Exports
export const publicIp = vmInstance.networkInterfaces.apply(
  ni => ni && ni[0]?.accessConfigs?.[0]?.natIp || "IP não disponível"
);
export const vmName = vmInstance.name;
export const vmZone = vmInstance.zone;