import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();
const publicKey = config.require("publicKey");

const vpc = new aws.ec2.Vpc("synit-aws-vpc", {
  cidrBlock: "10.0.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: "synit-aws-vpc",
  },
});

const publicSubnet = new aws.ec2.Subnet("synit-aws-public-subnet", {
  vpcId: vpc.id,
  cidrBlock: "10.0.1.0/24",
  availabilityZone: "us-east-1a",
  mapPublicIpOnLaunch: true,
  tags: {
    Name: "synit-aws-public-subnet",
  },
});

const igw = new aws.ec2.InternetGateway("synit-aws-igw", {
  vpcId: vpc.id,
  tags: {
    Name: "synit-aws-igw",
  },
});

const routeTable = new aws.ec2.RouteTable("synit-aws-public-route-table", {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: igw.id,
    },
  ],
  tags: {
    Name: "synit-aws-public-route-table",
  },
});

const routeTableAssociation = new aws.ec2.RouteTableAssociation("synit-aws-public-rta", {
  subnetId: publicSubnet.id,
  routeTableId: routeTable.id,
});

const securityGroup = new aws.ec2.SecurityGroup("synit-aws-web-sg", {
  vpcId: vpc.id,
  description: "Allow HTTP and SSH traffic",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"],
      description: "Allow HTTP",
    },
    {
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      cidrBlocks: ["0.0.0.0/0"],
      description: "Allow SSH",
    },
  ],
  egress: [
    {
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"],
      description: "Allow all outbound",
    },
  ],
  tags: {
    Name: "synit-aws-web-sg",
  },
});

const keyPair = new aws.ec2.KeyPair("synit-aws-keypair", {
  keyName: "synit-aws-keypair",
  publicKey,
  tags: {
    Name: "synit-aws-keypair",
  },
});

const ami = aws.ec2.getAmi({
  mostRecent: true,
  owners: ["amazon"],
  filters: [
    {
      name: "name",
      values: ["amzn2-ami-hvm-*-x86_64-gp2"],
    },
  ],
});

const instance = new aws.ec2.Instance("synit-aws-web-server", {
  instanceType: "t2.micro",
  ami: ami.then(ami => ami.id),
  subnetId: publicSubnet.id,
  vpcSecurityGroupIds: [securityGroup.id],
  keyName: keyPair.keyName,
  tags: {
    Name: "synit-aws-web-server",
  },
});

export const vpcId = vpc.id;
export const publicSubnetId = publicSubnet.id;
export const instanceId = instance.id;
export const instancePublicIp = instance.publicIp;
export const securityGroupId = securityGroup.id;