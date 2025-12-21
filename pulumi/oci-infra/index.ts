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

const natGateway = new oci.core.NatGateway('synit-nat', {
  compartmentId,
  vcnId: vcn.id,
  displayName: "synit-nat-arm",
});

const routeTable = new oci.core.RouteTable('route-table', {
  compartmentId,
  vcnId: vcn.id,
  displayName: "synit-route-table-arm",
  routeRules: [
    {
      networkEntityId: internetGateway.id,
      destination: "0.0.0.0/0",
    }
  ]
});

const privateRouteTable = new oci.core.RouteTable('private-route-table', {
  compartmentId,
  vcnId: vcn.id,
  displayName: "synit-private-route-table-arm",
  routeRules: [
    {
      networkEntityId: natGateway.id,
      destination: "0.0.0.0/0",
    }
  ]
});

const lbSecurityList = new oci.core.SecurityList('synit-lb-sls', {
  compartmentId,
  vcnId: vcn.id,
  displayName: "synit-lb-sls-arm",
  ingressSecurityRules: [
    {
      protocol: "6",
      source: "0.0.0.0/0",
      tcpOptions: { min: 80, max: 80 },
    },
    {
      protocol: "6",
      source: "0.0.0.0/0",
      tcpOptions: { min: 443, max: 443 },
    },
  ]
});

const instanceSecurityList = new oci.core.SecurityList('synit-instance-sls', {
  compartmentId,
  vcnId: vcn.id,
  displayName: "synit-instance-sls-arm",
  ingressSecurityRules: [
    {
      protocol: "6",
      source: "0.0.0.0/0",
      tcpOptions: { min: 22, max: 22 },
    },
    {
      protocol: "6",
      source: "0.0.0.0/0",
      tcpOptions: { min: 6443, max: 6443 },
    },
  ]
});

const publicSubnet = new oci.core.Subnet('synit-pub-subnet', {
  compartmentId,
  vcnId: vcn.id,
  cidrBlock: "10.0.1.0/24",
  displayName: "synit-subnet-arm",
  routeTableId: routeTable.id,
  securityListIds: [lbSecurityList.id],
});

const privateSubnet = new oci.core.Subnet('synit-priv-subnet', {
  compartmentId,
  vcnId: vcn.id,
  cidrBlock: "10.0.2.0/24",
  displayName: "synit-subnet-arm",
  routeTableId: privateRouteTable.id,
  securityListIds: [instanceSecurityList.id],
  prohibitPublicIpOnVnic: true,
});

const lb = new oci.loadbalancer.LoadBalancer('synit-lb', {
  compartmentId,
  shape: '10Mbps',
  subnetIds: [publicSubnet.id],
  displayName: "synit-lb-arm",
  isPrivate: false,
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
  operatingSystemVersion: '24.04',
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
      ocpus: 4,
      memoryInGbs: 24,
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
    subnetId: privateSubnet.id,
    assignPublicIp: 'false',
  },
  metadata: {
    "ssh_authorized_keys": sshPublicKey,
  }
});

export const instancePublicIp = vmInstance.publicIp;
export const usedAD = vmInstance.availabilityDomain;
export const usedShape = vmInstance.shape;