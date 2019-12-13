+++
title = "Building consistent virtual machines with Packer and Vagrant"
+++

I've been using [Vagrant](https://www.vagrantup.com/) to manage local development environments for a while, but there are subtle differences between the base Ubuntu Vagrant box and the [Ubuntu Cloud Images](http://cloud-images.ubuntu.com/) I typically use in production. Since the base set of packages don't match exactly, builds would occasionally fail on AWS after working fine locally. While I always caught these issues before they went live, the mismatch was annoying at best.

While looking to simplify a server image creation scheme, I saw an opportunity to standardize the base VMs across environments. My main goal was to replace a bespoke Amazon Machine Image (AMI) creation script with [Packer](https://www.packer.io/), which [not too coincidentally](https://github.com/mitchellh) ties in quite well with Vagrant.

The idea was to use a nearly identical base machine as a starting point both locally and on AWS. The first step is to get an Ubuntu Cloud Image suitable for use in Packer's [Virtualbox builder](https://www.packer.io/docs/builders/virtualbox-ovf.html). When passed the name of the Ubuntu release you wish to use (e.g. `$ dlbox.sh trusty`), the following script will unzip the .ovf/.vmdk files into an folder named `ubuntu.$RELEASE.box`.

```sh
#!/usr/bin/env bash
set -eu

BOX_URL=https://cloud-images.ubuntu.com/vagrant/$1/current/$1-server-cloudimg-amd64-vagrant-disk1.box
mkdir -p ubuntu.$1.box
curl $BOX_URL | tar -x -C ubuntu.$1.box
```

Next you need to identify a matching EC2 image with the [AMI Locator](http://cloud-images.ubuntu.com/locator/ec2/). At this moment, the EBS equivalent is `ami-e63b3e8e`.

With that, we can fill out a rudimentary `packer.conf`. This will launch matching machines locally and on AWS. [Provisioning steps](https://www.packer.io/docs/templates/provisioners.html) are very situation dependent, so I left them out.

```json
{
    "variables": {
        "release_id": null,

        "source_ovf": "ubuntu.trusty.box/box.ovf",
        "source_ami": "ami-64e27e0c",

        "vagrant_private_key": "{{ env `HOME` }}/.vagrant.d/insecure_private_key"
    },
    "builders": [
        {
            "name": "vagrant",
            "type": "virtualbox-ovf",
            "source_path": "{{ user `source_ovf` }}",
            "guest_additions_mode": "disable",
            "ssh_username": "vagrant",
            "ssh_key_path": "{{ user `vagrant_private_key` }}",
            "ssh_wait_timeout": "30s",
            "shutdown_command": "echo 'packer' | sudo -S shutdown -P now"
        },
        {
          "name": "aws",
          "source_ami": "{{ user `source_ami` }}",
          "ami_name": "aws.{{user `release_id`}}.{{isotime \"2006-01-02.0304\"}}",
          "type": "amazon-ebs",
          "region": "us-east-1",
          "instance_type": "t1.micro",
          "ssh_username": "ubuntu"
        }
    ],
    "post-processors": [
        [
            {
                "type": "vagrant",
                "only": ["vagrant"],
                "output": "web.{{user `release_id`}}.box"
            }
        ]
    ]
}
```

You can use the above config with this command (omit the -only flag to enable the AWS builder).

```sh
$ packer build -var 'release_id=foo' -only=vagrant packer.json
```

Obviously there are many customizations you can make to suit your situation. I actually feed a previously built image into packer as the source Box/AMI (just change/override the `source_*` variables). This enables a configuration management system such as [Salt](https://github.com/saltstack/salt), [Ansible](http://www.ansible.com/) or [Chef](https://www.chef.io/chef/) to update the images incrementally, potentially saving a ton of time.

This isn't an exhaustive tutorial on Packer, which has [excellent documentation](https://www.packer.io/intro) and a [helpful community](https://www.packer.io/community).
