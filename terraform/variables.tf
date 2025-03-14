variable "db_username" {
  description = "Database administrator username"
  type        = string
  default     = "cognivers_admin"
}

variable "db_password" {
  description = "Database administrator password"
  type        = string
  sensitive   = true
  default     = "" # Should be set via TF_VAR_db_password or secrets manager
}

variable "web_image" {
  description = "Docker image for web service"
  type        = string
  default     = "cognivers/web:latest"
}

variable "vpc_cidr" {
  description = "CIDR block for main VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24"]
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

