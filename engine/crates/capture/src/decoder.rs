//! Décodeur de protocoles réseau hiérarchique L2 à L4 (V0.2)
//!
//! Supporte :
//! - Liaison (L2) : Ethernet II, VLAN 802.1Q
//! - Réseau (L3) : IPv4, IPv6, ARP, ICMP (v4 & v6)
//! - Transport (L4) : TCP, UDP

use openndr_common::{OpenNdrError, PacketSummary};
use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, Ipv6Addr};

/// Classification rapide du protocole de niveau transport/application
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProtocolKind {
    Tcp,
    Udp,
    Icmp,
    Arp,
    Other,
}

/// En-tête Ethernet II
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EthernetHeader {
    pub src_mac: [u8; 6],
    pub dst_mac: [u8; 6],
    pub ethertype: u16,
}

impl EthernetHeader {
    pub fn src_mac_str(&self) -> String {
        format!(
            "{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
            self.src_mac[0], self.src_mac[1], self.src_mac[2], self.src_mac[3], self.src_mac[4], self.src_mac[5]
        )
    }

    pub fn dst_mac_str(&self) -> String {
        format!(
            "{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
            self.dst_mac[0], self.dst_mac[1], self.dst_mac[2], self.dst_mac[3], self.dst_mac[4], self.dst_mac[5]
        )
    }
}

/// En-tête VLAN 802.1Q
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VlanHeader {
    pub vlan_id: u16,
    pub priority: u8,
    pub drop_eligible: bool,
    pub encapsulated_ethertype: u16,
}

/// Paquet ARP
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ArpHeader {
    pub hardware_type: u16,
    pub protocol_type: u16,
    pub operation: u16, // 1 = Request, 2 = Reply
    pub sender_mac: [u8; 6],
    pub sender_ip: Ipv4Addr,
    pub target_mac: [u8; 6],
    pub target_ip: Ipv4Addr,
}

/// En-tête IPv4
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ipv4Header {
    pub src: Ipv4Addr,
    pub dst: Ipv4Addr,
    pub protocol: u8, // 6 = TCP, 17 = UDP, 1 = ICMP
    pub ttl: u8,
    pub total_length: u16,
    pub identification: u16,
    pub flags: u8,
    pub fragment_offset: u16,
}

/// En-tête IPv6
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ipv6Header {
    pub src: Ipv6Addr,
    pub dst: Ipv6Addr,
    pub next_header: u8,
    pub hop_limit: u8,
    pub payload_length: u16,
}

/// Drapeaux TCP
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TcpFlags {
    pub syn: bool,
    pub ack: bool,
    pub fin: bool,
    pub rst: bool,
    pub psh: bool,
    pub urg: bool,
}

/// En-tête TCP
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TcpHeader {
    pub src_port: u16,
    pub dst_port: u16,
    pub sequence_number: u32,
    pub acknowledgment_number: u32,
    pub data_offset: usize, // en octets
    pub flags: TcpFlags,
    pub window_size: u16,
    pub payload_length: usize,
}

/// En-tête UDP
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UdpHeader {
    pub src_port: u16,
    pub dst_port: u16,
    pub length: u16,
    pub payload_length: usize,
}

/// En-tête ICMP (v4 & v6)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IcmpHeader {
    pub icmp_type: u8,
    pub code: u8,
    pub echo_identifier: Option<u16>,
    pub echo_sequence: Option<u16>,
}

/// Paquet entièrement décodé par les couches L2 à L4
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecodedPacket {
    pub timestamp_us: u64,
    pub raw_len: usize,
    pub captured_len: usize,
    pub ethernet: Option<EthernetHeader>,
    pub vlan: Option<VlanHeader>,
    pub arp: Option<ArpHeader>,
    pub ipv4: Option<Ipv4Header>,
    pub ipv6: Option<Ipv6Header>,
    pub tcp: Option<TcpHeader>,
    pub udp: Option<UdpHeader>,
    pub icmp: Option<IcmpHeader>,
    pub protocol: ProtocolKind,
}

impl DecodedPacket {
    /// Convertit le paquet décodé en résumé structuré L2-L4 pour la télémétrie et le SOC
    pub fn to_summary(&self) -> PacketSummary {
        let src_mac = self
            .ethernet
            .as_ref()
            .map(|e| e.src_mac_str())
            .unwrap_or_else(|| "00:00:00:00:00:00".to_string());
        let dst_mac = self
            .ethernet
            .as_ref()
            .map(|e| e.dst_mac_str())
            .unwrap_or_else(|| "00:00:00:00:00:00".to_string());

        let (src_ip, dst_ip) = if let Some(ip4) = &self.ipv4 {
            (Some(ip4.src.to_string()), Some(ip4.dst.to_string()))
        } else if let Some(ip6) = &self.ipv6 {
            (Some(ip6.src.to_string()), Some(ip6.dst.to_string()))
        } else if let Some(arp) = &self.arp {
            (Some(arp.sender_ip.to_string()), Some(arp.target_ip.to_string()))
        } else {
            (None, None)
        };

        let (src_port, dst_port, tcp_flags) = if let Some(tcp) = &self.tcp {
            let mut flags = Vec::new();
            if tcp.flags.syn { flags.push("SYN"); }
            if tcp.flags.ack { flags.push("ACK"); }
            if tcp.flags.fin { flags.push("FIN"); }
            if tcp.flags.rst { flags.push("RST"); }
            if tcp.flags.psh { flags.push("PSH"); }
            if tcp.flags.urg { flags.push("URG"); }
            (
                Some(tcp.src_port),
                Some(tcp.dst_port),
                if flags.is_empty() { None } else { Some(flags.join(",")) },
            )
        } else if let Some(udp) = &self.udp {
            (Some(udp.src_port), Some(udp.dst_port), None)
        } else {
            (None, None, None)
        };

        let protocol_str = match self.protocol {
            ProtocolKind::Tcp => "TCP",
            ProtocolKind::Udp => "UDP",
            ProtocolKind::Icmp => {
                if self.ipv6.is_some() { "ICMPv6" } else { "ICMP" }
            }
            ProtocolKind::Arp => "ARP",
            ProtocolKind::Other => "OTHER",
        }
        .to_string();

        let info = if let Some(tcp) = &self.tcp {
            format!(
                "{} -> {} [{}] len={}",
                tcp.src_port,
                tcp.dst_port,
                tcp_flags.as_deref().unwrap_or("NONE"),
                tcp.payload_length
            )
        } else if let Some(udp) = &self.udp {
            format!("{} -> {} len={}", udp.src_port, udp.dst_port, udp.payload_length)
        } else if let Some(icmp) = &self.icmp {
            format!("type={} code={}", icmp.icmp_type, icmp.code)
        } else if let Some(arp) = &self.arp {
            let op = if arp.operation == 1 { "Who has" } else { "Reply" };
            format!("{} {} (sender {})", op, arp.target_ip, arp.sender_ip)
        } else {
            format!("EtherType 0x{:04x}", self.ethernet.as_ref().map(|e| e.ethertype).unwrap_or(0))
        };

        PacketSummary {
            timestamp_us: self.timestamp_us,
            raw_len: self.raw_len,
            protocol: protocol_str,
            vlan_id: self.vlan.as_ref().map(|v| v.vlan_id),
            src_mac,
            dst_mac,
            src_ip,
            dst_ip,
            src_port,
            dst_port,
            tcp_flags,
            info,
        }
    }
}

/// Décodeur principal sans copie superflue
pub fn decode_packet(data: &[u8], timestamp_us: u64) -> Result<DecodedPacket, OpenNdrError> {
    if data.len() < 14 {
        return Err(OpenNdrError::DecodeError(
            "Paquet trop court pour un en-tête Ethernet II".to_string(),
        ));
    }

    let mut offset = 0;

    // 1. Couche L2 : Ethernet II
    let mut dst_mac = [0u8; 6];
    let mut src_mac = [0u8; 6];
    dst_mac.copy_from_slice(&data[0..6]);
    src_mac.copy_from_slice(&data[6..12]);
    let mut ethertype = u16::from_be_bytes([data[12], data[13]]);
    offset += 14;

    let mut vlan_header = None;

    // Détection VLAN 802.1Q (EtherType 0x8100)
    if ethertype == 0x8100 {
        if data.len() < offset + 4 {
            return Err(OpenNdrError::DecodeError("En-tête VLAN tronqué".to_string()));
        }
        let tci = u16::from_be_bytes([data[offset], data[offset + 1]]);
        let vlan_id = tci & 0x0FFF;
        let priority = ((tci >> 13) & 0x07) as u8;
        let drop_eligible = ((tci >> 12) & 0x01) == 1;
        let encapsulated = u16::from_be_bytes([data[offset + 2], data[offset + 3]]);
        offset += 4;

        vlan_header = Some(VlanHeader {
            vlan_id,
            priority,
            drop_eligible,
            encapsulated_ethertype: encapsulated,
        });
        ethertype = encapsulated;
    }

    let ethernet_header = EthernetHeader {
        src_mac,
        dst_mac,
        ethertype,
    };

    let mut arp_header = None;
    let mut ipv4_header = None;
    let mut ipv6_header = None;
    let mut tcp_header = None;
    let mut udp_header = None;
    let mut icmp_header = None;
    let mut protocol_kind = ProtocolKind::Other;

    // 2. Couche L3
    match ethertype {
        0x0806 => {
            // ARP
            protocol_kind = ProtocolKind::Arp;
            if data.len() >= offset + 28 {
                let hw_type = u16::from_be_bytes([data[offset], data[offset + 1]]);
                let proto_type = u16::from_be_bytes([data[offset + 2], data[offset + 3]]);
                let operation = u16::from_be_bytes([data[offset + 6], data[offset + 7]]);
                let mut s_mac = [0u8; 6];
                s_mac.copy_from_slice(&data[offset + 8..offset + 14]);
                let s_ip = Ipv4Addr::new(
                    data[offset + 14],
                    data[offset + 15],
                    data[offset + 16],
                    data[offset + 17],
                );
                let mut t_mac = [0u8; 6];
                t_mac.copy_from_slice(&data[offset + 18..offset + 24]);
                let t_ip = Ipv4Addr::new(
                    data[offset + 24],
                    data[offset + 25],
                    data[offset + 26],
                    data[offset + 27],
                );

                arp_header = Some(ArpHeader {
                    hardware_type: hw_type,
                    protocol_type: proto_type,
                    operation,
                    sender_mac: s_mac,
                    sender_ip: s_ip,
                    target_mac: t_mac,
                    target_ip: t_ip,
                });
            }
        }
        0x0800 => {
            // IPv4
            if data.len() >= offset + 20 {
                let version_ihl = data[offset];
                let version = version_ihl >> 4;
                let ihl = (version_ihl & 0x0F) as usize * 4;
                if version == 4 && ihl >= 20 && data.len() >= offset + ihl {
                    let total_len = u16::from_be_bytes([data[offset + 2], data[offset + 3]]);
                    let id = u16::from_be_bytes([data[offset + 4], data[offset + 5]]);
                    let flags_frag = u16::from_be_bytes([data[offset + 6], data[offset + 7]]);
                    let flags = ((flags_frag >> 13) & 0x07) as u8;
                    let frag_offset = flags_frag & 0x1FFF;
                    let ttl = data[offset + 8];
                    let ip_proto = data[offset + 9];
                    let src = Ipv4Addr::new(
                        data[offset + 12],
                        data[offset + 13],
                        data[offset + 14],
                        data[offset + 15],
                    );
                    let dst = Ipv4Addr::new(
                        data[offset + 16],
                        data[offset + 17],
                        data[offset + 18],
                        data[offset + 19],
                    );

                    ipv4_header = Some(Ipv4Header {
                        src,
                        dst,
                        protocol: ip_proto,
                        ttl,
                        total_length: total_len,
                        identification: id,
                        flags,
                        fragment_offset: frag_offset,
                    });

                    let l4_offset = offset + ihl;
                    decode_l4(
                        data,
                        l4_offset,
                        ip_proto,
                        &mut tcp_header,
                        &mut udp_header,
                        &mut icmp_header,
                        &mut protocol_kind,
                    );
                }
            }
        }
        0x86DD => {
            // IPv6
            if data.len() >= offset + 40 {
                let payload_len = u16::from_be_bytes([data[offset + 4], data[offset + 5]]);
                let next_header = data[offset + 6];
                let hop_limit = data[offset + 7];
                let mut s_bytes = [0u8; 16];
                let mut d_bytes = [0u8; 16];
                s_bytes.copy_from_slice(&data[offset + 8..offset + 24]);
                d_bytes.copy_from_slice(&data[offset + 24..offset + 40]);
                let src = Ipv6Addr::from(s_bytes);
                let dst = Ipv6Addr::from(d_bytes);

                ipv6_header = Some(Ipv6Header {
                    src,
                    dst,
                    next_header,
                    hop_limit,
                    payload_length: payload_len,
                });

                let l4_offset = offset + 40;
                decode_l4(
                    data,
                    l4_offset,
                    next_header,
                    &mut tcp_header,
                    &mut udp_header,
                    &mut icmp_header,
                    &mut protocol_kind,
                );
            }
        }
        _ => {
            protocol_kind = ProtocolKind::Other;
        }
    }

    Ok(DecodedPacket {
        timestamp_us,
        raw_len: data.len(),
        captured_len: data.len(),
        ethernet: Some(ethernet_header),
        vlan: vlan_header,
        arp: arp_header,
        ipv4: ipv4_header,
        ipv6: ipv6_header,
        tcp: tcp_header,
        udp: udp_header,
        icmp: icmp_header,
        protocol: protocol_kind,
    })
}

/// Décode la couche L4 (TCP / UDP / ICMP)
fn decode_l4(
    data: &[u8],
    offset: usize,
    protocol_num: u8,
    tcp_out: &mut Option<TcpHeader>,
    udp_out: &mut Option<UdpHeader>,
    icmp_out: &mut Option<IcmpHeader>,
    proto_kind: &mut ProtocolKind,
) {
    match protocol_num {
        6 => {
            // TCP
            *proto_kind = ProtocolKind::Tcp;
            if data.len() >= offset + 20 {
                let src_port = u16::from_be_bytes([data[offset], data[offset + 1]]);
                let dst_port = u16::from_be_bytes([data[offset + 2], data[offset + 3]]);
                let seq = u32::from_be_bytes([
                    data[offset + 4],
                    data[offset + 5],
                    data[offset + 6],
                    data[offset + 7],
                ]);
                let ack = u32::from_be_bytes([
                    data[offset + 8],
                    data[offset + 9],
                    data[offset + 10],
                    data[offset + 11],
                ]);
                let data_offset_val = ((data[offset + 12] >> 4) as usize) * 4;
                let flags_byte = data[offset + 13];
                let win = u16::from_be_bytes([data[offset + 14], data[offset + 15]]);

                let flags = TcpFlags {
                    fin: (flags_byte & 0x01) != 0,
                    syn: (flags_byte & 0x02) != 0,
                    rst: (flags_byte & 0x04) != 0,
                    psh: (flags_byte & 0x08) != 0,
                    ack: (flags_byte & 0x10) != 0,
                    urg: (flags_byte & 0x20) != 0,
                };

                let payload_len = if data.len() >= offset + data_offset_val {
                    data.len() - (offset + data_offset_val)
                } else {
                    0
                };

                *tcp_out = Some(TcpHeader {
                    src_port,
                    dst_port,
                    sequence_number: seq,
                    acknowledgment_number: ack,
                    data_offset: data_offset_val,
                    flags,
                    window_size: win,
                    payload_length: payload_len,
                });
            }
        }
        17 => {
            // UDP
            *proto_kind = ProtocolKind::Udp;
            if data.len() >= offset + 8 {
                let src_port = u16::from_be_bytes([data[offset], data[offset + 1]]);
                let dst_port = u16::from_be_bytes([data[offset + 2], data[offset + 3]]);
                let length = u16::from_be_bytes([data[offset + 4], data[offset + 5]]);
                let payload_len = if data.len() >= offset + 8 {
                    data.len() - (offset + 8)
                } else {
                    0
                };

                *udp_out = Some(UdpHeader {
                    src_port,
                    dst_port,
                    length,
                    payload_length: payload_len,
                });
            }
        }
        1 | 58 => {
            // ICMPv4 (1) ou ICMPv6 (58)
            *proto_kind = ProtocolKind::Icmp;
            if data.len() >= offset + 4 {
                let icmp_type = data[offset];
                let code = data[offset + 1];
                let mut echo_id = None;
                let mut echo_seq = None;

                // Si Echo Request (8 v4 / 128 v6) ou Echo Reply (0 v4 / 129 v6)
                if (icmp_type == 8 || icmp_type == 0 || icmp_type == 128 || icmp_type == 129)
                    && data.len() >= offset + 8
                {
                    echo_id = Some(u16::from_be_bytes([data[offset + 4], data[offset + 5]]));
                    echo_seq = Some(u16::from_be_bytes([data[offset + 6], data[offset + 7]]));
                }

                *icmp_out = Some(IcmpHeader {
                    icmp_type,
                    code,
                    echo_identifier: echo_id,
                    echo_sequence: echo_seq,
                });
            }
        }
        _ => {
            *proto_kind = ProtocolKind::Other;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_ethernet_arp() {
        // Trame ARP Request
        let pkt = vec![
            // Eth: Dst (ff:ff:ff:ff:ff:ff), Src (00:11:22:33:44:55), Type (0x0806)
            0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
            0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
            0x08, 0x06,
            // ARP: HW=1, Proto=0x0800, HW_len=6, Proto_len=4, Op=1 (Request)
            0x00, 0x01, 0x08, 0x00, 0x06, 0x04, 0x00, 0x01,
            // Sender MAC & IP
            0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 192, 168, 1, 10,
            // Target MAC & IP
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 192, 168, 1, 1,
        ];
        let decoded = decode_packet(&pkt, 1000).expect("Décodage ARP valide");
        assert_eq!(decoded.protocol, ProtocolKind::Arp);
        let arp = decoded.arp.expect("ARP header");
        assert_eq!(arp.operation, 1);
        assert_eq!(arp.sender_ip, Ipv4Addr::new(192, 168, 1, 10));
        assert_eq!(arp.target_ip, Ipv4Addr::new(192, 168, 1, 1));
    }

    #[test]
    fn test_decode_ipv4_tcp_syn() {
        // Trame Ethernet + IPv4 + TCP SYN
        let pkt = vec![
            // Eth: Dst, Src, Type 0x0800
            0x00, 0x50, 0x56, 0xc0, 0x00, 0x01,
            0x00, 0x50, 0x56, 0xc0, 0x00, 0x02,
            0x08, 0x00,
            // IPv4: Version=4, IHL=5, DSCP=0, TotalLen=44, ID=1234, Flags=2 (DF), TTL=64, Proto=6 (TCP), Checksum=0
            0x45, 0x00, 0x00, 0x2c, 0x04, 0xd2, 0x40, 0x00, 0x40, 0x06, 0x00, 0x00,
            10, 0, 0, 1, // Src
            10, 0, 0, 2, // Dst
            // TCP: SrcPort=54321, DstPort=443, Seq=100, Ack=0, DataOffset=5 (20B), Flags=0x02 (SYN), Win=65535, Chk=0, Urg=0
            0xd4, 0x31, 0x01, 0xbb,
            0x00, 0x00, 0x00, 0x64,
            0x00, 0x00, 0x00, 0x00,
            0x50, 0x02, 0xff, 0xff,
            0x00, 0x00, 0x00, 0x00,
        ];
        let decoded = decode_packet(&pkt, 2000).expect("Décodage TCP SYN valide");
        assert_eq!(decoded.protocol, ProtocolKind::Tcp);
        let ip = decoded.ipv4.expect("IPv4 header");
        assert_eq!(ip.src, Ipv4Addr::new(10, 0, 0, 1));
        assert_eq!(ip.dst, Ipv4Addr::new(10, 0, 0, 2));
        let tcp = decoded.tcp.expect("TCP header");
        assert_eq!(tcp.src_port, 54321);
        assert_eq!(tcp.dst_port, 443);
        assert!(tcp.flags.syn);
        assert!(!tcp.flags.ack);
    }

    #[test]
    fn test_decode_vlan_8021q_udp() {
        // Trame avec tag VLAN 802.1Q (VID 100) + IPv4 + UDP (DNS 53)
        let pkt = vec![
            // Eth: Dst, Src, Type 0x8100 (VLAN)
            0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
            0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb,
            0x81, 0x00,
            // VLAN: TCI = (0 << 13) | 100 = 0x0064, Encapsulated = 0x0800
            0x00, 0x64, 0x08, 0x00,
            // IPv4: Version=4, IHL=5, TotalLen=28, TTL=64, Proto=17 (UDP)
            0x45, 0x00, 0x00, 0x1c, 0x00, 0x01, 0x00, 0x00, 0x40, 0x11, 0x00, 0x00,
            192, 168, 100, 50, 192, 168, 100, 1,
            // UDP: SrcPort=49152, DstPort=53, Len=8, Chk=0
            0xc0, 0x00, 0x00, 0x35, 0x00, 0x08, 0x00, 0x00,
        ];
        let decoded = decode_packet(&pkt, 3000).expect("Décodage VLAN UDP valide");
        assert_eq!(decoded.protocol, ProtocolKind::Udp);
        let vlan = decoded.vlan.as_ref().expect("VLAN header");
        assert_eq!(vlan.vlan_id, 100);
        let udp = decoded.udp.as_ref().expect("UDP header");
        assert_eq!(udp.src_port, 49152);
        assert_eq!(udp.dst_port, 53);
        let summary = decoded.to_summary();
        assert_eq!(summary.vlan_id, Some(100));
        assert_eq!(summary.protocol, "UDP");
    }

    #[test]
    fn test_decode_ipv6_tcp_and_icmpv6() {
        // IPv6 + TCP (443)
        let mut pkt_v6_tcp = vec![
            0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
            0x11, 0x22, 0x33, 0x44, 0x55, 0x66,
            0x86, 0xdd, // IPv6 EtherType
            // IPv6 Header (40 bytes): version=6, payload_len=20, next_header=6 (TCP), hop_limit=64
            0x60, 0x00, 0x00, 0x00, 0x00, 0x14, 0x06, 0x40,
        ];
        // Src ::1 (16 bytes)
        pkt_v6_tcp.extend_from_slice(&[0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1]);
        // Dst 2001:db8::1 (16 bytes)
        pkt_v6_tcp.extend_from_slice(&[0x20,0x01,0x0d,0xb8, 0,0,0,0, 0,0,0,0, 0,0,0,1]);
        // TCP header (20 bytes): src=12345 (0x3039), dst=443 (0x01bb), SYN+ACK (0x12)
        pkt_v6_tcp.extend_from_slice(&[
            0x30, 0x39, 0x01, 0xbb,
            0x00, 0x00, 0x00, 0x01,
            0x00, 0x00, 0x00, 0x02,
            0x50, 0x12, 0x20, 0x00,
            0x00, 0x00, 0x00, 0x00,
        ]);

        let decoded = decode_packet(&pkt_v6_tcp, 4000).expect("Décodage IPv6 TCP valide");
        assert_eq!(decoded.protocol, ProtocolKind::Tcp);
        let ip6 = decoded.ipv6.as_ref().expect("IPv6 header");
        assert_eq!(ip6.src, "::1".parse::<Ipv6Addr>().unwrap());
        assert_eq!(ip6.dst, "2001:db8::1".parse::<Ipv6Addr>().unwrap());
        let summary = decoded.to_summary();
        assert_eq!(summary.tcp_flags.as_deref(), Some("SYN,ACK"));

        // IPv4 + ICMP Echo Request
        let pkt_icmp = vec![
            0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
            0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb,
            0x08, 0x00,
            0x45, 0x00, 0x00, 0x1c, 0x00, 0x02, 0x00, 0x00, 0x40, 0x01, 0x00, 0x00,
            10, 1, 1, 1, 10, 1, 1, 2,
            0x08, 0x00, 0x00, 0x00, 0x12, 0x34, 0x00, 0x05,
        ];
        let dec_icmp = decode_packet(&pkt_icmp, 5000).expect("Décodage ICMP valide");
        assert_eq!(dec_icmp.protocol, ProtocolKind::Icmp);
        let icmp = dec_icmp.icmp.expect("ICMP header");
        assert_eq!(icmp.icmp_type, 8);
        assert_eq!(icmp.echo_identifier, Some(0x1234));
        assert_eq!(icmp.echo_sequence, Some(5));
    }

    #[test]
    fn test_truncated_frame_resilience() {
        assert!(matches!(decode_packet(&[0u8; 5], 0), Err(OpenNdrError::DecodeError(_))));
        // Truncated VLAN header
        let trunc_vlan = vec![0u8,0,0,0,0,0, 0,0,0,0,0,0, 0x81, 0x00, 0x00];
        assert!(matches!(decode_packet(&trunc_vlan, 0), Err(OpenNdrError::DecodeError(_))));
    }
}
