import dns from "node:dns";

// Some networks/ISPs block SRV lookups that mongodb+srv:// needs.
// Use public DNS servers for Node's resolver instead.
dns.setServers(["8.8.8.8", "1.1.1.1"]);