import * as pulumi from '@pulumi/pulumi';
import * as oci from '@pulumi/oci';

const config = new pulumi.Config();
const compartmentId = config.require('compartmentId');
const sshPublicKey = config.require('sshPublicKey');
const shape = config.get('shape') || 'VM.Standard.E2.1.Micro';

const vcn = new oci.core.Vcn('synit-vcn', {
  compartmentId,
  cidrBlock: "10.0.0.0/16",
  displayName: "synit-vcn-arm",
});

const internetGateway = new oci.core.InternetGateway('synit-igw', {
  compartmentId,
  vcnId: vcn.id,
  enabled: true,
});

const routeTable = new oci.core.DefaultRouteTable('route-table', {
  manageDefaultResourceId: vcn.defaultRouteTableId,
  routeRules: [
    {
      networkEntityId: internetGateway.id,
      destination: "0.0.0.0/0",
    }
  ]
});

const subnet = new oci.core.Subnet('synit-subnet', {
  compartmentId,
  vcnId: vcn.id,
  cidrBlock: "10.0.1.0/24",
  displayName: "synit-subnet-arm",
  routeTableId: routeTable.id,
  prohibitPublicIpOnVnic: false,
});

new oci.artifacts.ContainerRepository('synit-repo', {
  compartmentId,
  displayName: "synit-repo-arm",
  isPublic: false,
});

const ads = oci.identity.getAvailabilityDomains({
  compartmentId,
});

const ubuntuImage = oci.core.getImages({
  compartmentId,
  operatingSystem: 'Canonical Ubuntu',
  operatingSystemVersion: '20.04',
  shape,
  sortBy: 'TIMECREATED',
  sortOrder: 'DESC',
});

const vmInstance = new oci.core.Instance('synit-vm', {
  compartmentId,
  availabilityDomain: ads.then((ads) => ads.availabilityDomains[0].name),
  shape,
  ...(shape === 'VM.Standard.A1.Flex' && {
    shapeConfig: {
      ocpus: 1,
      memoryInGbs: 6,
    }
  }),
  sourceDetails: {
    sourceType: 'image',
    sourceId: ubuntuImage.then((data) => {
      if (!data.images || data.images.length === 0) {
        throw new Error(`Nenhuma imagem encontrada para shape ${shape}`);
      }
      return data.images[0].id;
    }),
  },
  createVnicDetails: {
    subnetId: subnet.id,
    assignPublicIp: 'true',
  },
  metadata: {
    "ssh_authorized_keys": sshPublicKey,
  }
});

export const instancePublicIp = vmInstance.publicIp;
export const usedAD = vmInstance.availabilityDomain;
export const usedShape = vmInstance.shape;