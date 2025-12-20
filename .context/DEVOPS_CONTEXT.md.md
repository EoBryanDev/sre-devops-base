# DEVOPS & INFRASTRUCTURE CONTEXT

## 1. Project Overview

This document outlines a production-ready infrastructure setup hosted on Oracle Cloud Infrastructure (OCI) using its "Always Free" tier resources. The architecture is built around a lightweight K3s Kubernetes cluster running on a single ARM-based compute instance. Infrastructure is managed via Pulumi (IaC), with a GitOps-driven deployment pipeline using GitHub Actions, ArgoCD, and Sealed Secrets for secure secret management. Observability is provided by the Grafana Cloud free tier.

## 2. Tech Stack Definition

- **Environment:** Production
- **Cloud/Host:** OCI (Oracle Cloud Infrastructure) on "Always Free" ARM Ampere A1 instances.
- **IaC/Setup Tool:** Pulumi (with local state management).
- **CI/CD:** GitHub Actions for CI (build/push) and ArgoCD for CD (GitOps deployment).
- **Orchestrator:** K3s (Lightweight Kubernetes).
- **Container Registry:** OCIR (Oracle Cloud Infrastructure Registry).
- **Observability:** Grafana Cloud (Free Tier) for metrics.
- **Secret Management:** Sealed Secrets.

## 3. Infrastructure Architecture (Rules)

- **Networking/Exposure:**
    - The OCI Compute Instance will have a public IP.
    - OCI Security Lists (firewall) must be configured to allow ingress traffic for HTTP/S (ports 80, 443) and the Kubernetes API (port 6443) from trusted sources.
    - K3s's built-in Traefik Ingress Controller will be used to expose services to the internet.

- **Storage/State:**
    - Pulumi state will be managed locally on the developer's machine.
    - K3s will use the local storage of the VM. Application data persistence will be handled by K3s's default `local-path-provisioner`. This is suitable for single-node clusters but has no redundancy.

- **Compute Specs:**
    - The entire infrastructure will run on a single OCI `VM.Standard.A1.Flex` instance (ARM64 architecture) configured within the "Always Free" limits (e.g., 4 OCPUs, 24 GB RAM).
    - All Docker images **must** be built for the `linux/arm64` architecture.

## 4. Pipeline & Deployment Strategy

- **Branching Strategy:** Trunk-based development. All changes are merged directly into the `main` branch.
- **Triggers:** The CI pipeline is triggered on every push to the `main` branch.
- **Build Process (CI - GitHub Actions):**
    1. Check out the source code.
    2. Log in to OCIR using credentials stored in GitHub Secrets.
    3. Build and tag a multi-arch (or `linux/arm64`) Docker image.
    4. Push the image to OCIR.
    5. Update the `image.tag` value in a `values.yaml` file within a separate "manifest" Git repository.
- **Deployment Method (CD - ArgoCD):**
    1. An ArgoCD instance runs inside the K3s cluster.
    2. It is configured to watch the "manifest" Git repository.
    3. When the image tag is updated in the manifest repo (by the CI pipeline), ArgoCD detects the change.
    4. ArgoCD automatically syncs the state, pulling the new Helm chart version or values, which triggers a rolling update of the application pods in the cluster.

## 5. Engineering Prompts for Coding AI

> **For Pulumi (IaC):** "Generate Pulumi code using TypeScript or Python to provision an OCI 'Always Free' `VM.Standard.A1.Flex` compute instance. The code must configure the necessary VCN, subnets, and security lists. It should accept a public SSH key and use `cloud-init` (`userData`) to run a setup script on the first boot. The script's content will be provided separately."

> **For K3s & Cluster Setup (userData script):** "Create a `cloud-init` shell script that performs the following actions: 1. Installs K3s. 2. Installs the ArgoCD CLI and sets up ArgoCD in the cluster. 3. Installs the Sealed Secrets controller. 4. Creates the necessary Kubernetes namespaces."

> **For GitHub Actions (CI):** "Create a GitHub Actions workflow file (`.github/workflows/ci.yml`). This workflow must trigger on push to `main`, build a Docker image for the `linux/arm64` platform, push it to OCIR, and then check out a separate manifest repository to update an image tag in a `values.yaml` file using `sed` or `yq`."

> **For Kubernetes & Helm:** "Generate a Helm chart for the application. It must include templates for Deployment, Service, and Ingress (using `traefik` as the ingress class). Parameterize the image repository, tag, resource requests/limits, and replica count in the `values.yaml` file."

> **For ArgoCD:** "Provide the YAML manifest for an ArgoCD `Application` resource. This resource should point to the manifest Git repository, track the `main` branch, and use the path containing the application's Helm chart. Enable `auto-sync` and `prune` policies."

> **For Sealed Secrets:** "All Kubernetes `Secret` manifests must be encrypted into `SealedSecret` manifests. Provide a clear, step-by-step guide on how a developer can use the `kubeseal` CLI to encrypt a local secret file against the controller running in the cluster."

> **For Observability:** "Show how to configure a Prometheus agent (e.g., Grafana Agent or Prometheus with `remote_write`) to scrape metrics from the cluster and send them to a Grafana Cloud Prometheus endpoint. The necessary credentials (username, API key) must be stored as standard Kubernetes secrets, which will then be encrypted using Sealed Secrets."