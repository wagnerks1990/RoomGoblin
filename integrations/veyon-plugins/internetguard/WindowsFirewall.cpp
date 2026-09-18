// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2025-2026 Raffaele Mele and RoomGoblin contributors.
// Transactional Windows Firewall backend derived from
// lellomele/veyon-internet-guard at 90a07f366d7fe311beeee0074022b933b4100e51.
#include "WindowsFirewall.h"

#include <QtGlobal>
#include <windows.h>
#include <netfw.h>
#include <oleauto.h>

namespace
{
const CLSID PolicyClass = {0xE2B3C97F, 0x6AE1, 0x41AC, {0x81,0x7A,0xF6,0xF9,0x21,0x66,0xD7,0xDD}};
const IID PolicyInterface = {0x98325047,0xC671,0x4174,{0x8D,0x81,0xDE,0xFC,0xD3,0xF0,0x31,0x86}};
const CLSID RuleClass = {0x2C5BC43E,0x3369,0x4C33,{0xAB,0x0C,0xBE,0x94,0x69,0x67,0x7A,0xF4}};
const IID RuleInterface = {0xAF230D27,0xBABA,0x4E42,{0xAC,0xED,0xF5,0x24,0xF2,0x2C,0xFC,0xE2}};

template<typename T> class ComPtr
{
public:
	~ComPtr() { if(m_value) m_value->Release(); }
	T* operator->() const { return m_value; }
	T* get() const { return m_value; }
	void** out() { return reinterpret_cast<void**>(&m_value); }
	T** typedOut() { return &m_value; }
private:
	T* m_value{nullptr};
};

class ComInit
{
public:
	ComInit()
	{
		const auto result = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
		m_uninitialize = SUCCEEDED(result);
		m_usable = SUCCEEDED(result) || result == RPC_E_CHANGED_MODE;
	}
	~ComInit() { if(m_uninitialize) CoUninitialize(); }
	bool usable() const { return m_usable; }
private:
	bool m_uninitialize{false};
	bool m_usable{false};
};

class Bstr
{
public:
	explicit Bstr(const wchar_t* value) : m_value(SysAllocString(value)) {}
	~Bstr() { SysFreeString(m_value); }
	operator BSTR() const { return m_value; }
private:
	BSTR m_value;
};

struct RuleSpec { const wchar_t* name; long protocol; const wchar_t* ports; };
const RuleSpec Rules[] = {
	{L"RoomGoblinVeyonIG_HTTP", NET_FW_IP_PROTOCOL_TCP, L"80"},
	{L"RoomGoblinVeyonIG_HTTPS", NET_FW_IP_PROTOCOL_TCP, L"443"},
	{L"RoomGoblinVeyonIG_DNS_TCP", NET_FW_IP_PROTOCOL_TCP, L"53"},
	{L"RoomGoblinVeyonIG_DNS_UDP", NET_FW_IP_PROTOCOL_UDP, L"53"},
	{L"RoomGoblinVeyonIG_QUIC", NET_FW_IP_PROTOCOL_UDP, L"443"},
	{L"RoomGoblinVeyonIG_DOT_TCP", NET_FW_IP_PROTOCOL_TCP, L"853"},
	{L"RoomGoblinVeyonIG_DOT_UDP", NET_FW_IP_PROTOCOL_UDP, L"853"},
	{L"RoomGoblinVeyonIG_PROXY", NET_FW_IP_PROTOCOL_TCP, L"3128,8080,8443"},
};

bool openFirewall(ComPtr<INetFwPolicy2>& policy, ComPtr<INetFwRules>& rules)
{
	auto result = CoCreateInstance(PolicyClass, nullptr, CLSCTX_INPROC_SERVER,
		PolicyInterface, policy.out());
	if(FAILED(result)) return false;
	return SUCCEEDED(policy->get_Rules(rules.typedOut()));
}

bool activeProfilesAreEnabled(INetFwPolicy2* policy)
{
	long active = 0;
	if(FAILED(policy->get_CurrentProfileTypes(&active))) return false;
	for(const auto profile : {NET_FW_PROFILE2_DOMAIN, NET_FW_PROFILE2_PRIVATE, NET_FW_PROFILE2_PUBLIC})
	{
		if((active & profile) == 0) continue;
		VARIANT_BOOL enabled = VARIANT_FALSE;
		if(FAILED(policy->get_FirewallEnabled(profile, &enabled)) || enabled != VARIANT_TRUE)
		{
			qWarning("[InternetGuard] active Windows Firewall profile is disabled; refusing to change host policy");
			return false;
		}
	}
	return true;
}

bool removeByName(INetFwRules* rules, const wchar_t* name)
{
	const Bstr ruleName(name);
	for(int count = 0; count < 64; ++count)
	{
		ComPtr<INetFwRule> existing;
		if(FAILED(rules->Item(ruleName, existing.typedOut()))) return true;
		if(FAILED(rules->Remove(ruleName))) return false;
	}
	return false;
}

bool removeAll(INetFwRules* rules)
{
	bool result = true;
	for(const auto& rule : Rules) result = removeByName(rules, rule.name) && result;
	return result;
}

bool addRule(INetFwRules* rules, const RuleSpec& spec)
{
	ComPtr<INetFwRule> rule;
	auto result = CoCreateInstance(RuleClass, nullptr, CLSCTX_INPROC_SERVER,
		RuleInterface, rule.out());
	if(SUCCEEDED(result)) result = rule->put_Name(Bstr(spec.name));
	if(SUCCEEDED(result)) result = rule->put_Description(Bstr(L"Temporary RoomGoblin Veyon pilot rule"));
	if(SUCCEEDED(result)) result = rule->put_Grouping(Bstr(L"RoomGoblin Veyon InternetGuard Pilot"));
	if(SUCCEEDED(result)) result = rule->put_Protocol(spec.protocol);
	if(SUCCEEDED(result)) result = rule->put_RemotePorts(Bstr(spec.ports));
	if(SUCCEEDED(result)) result = rule->put_Direction(NET_FW_RULE_DIR_OUT);
	if(SUCCEEDED(result)) result = rule->put_Action(NET_FW_ACTION_BLOCK);
	if(SUCCEEDED(result)) result = rule->put_Profiles(NET_FW_PROFILE2_ALL);
	if(SUCCEEDED(result)) result = rule->put_Enabled(VARIANT_TRUE);
	if(SUCCEEDED(result)) result = rules->Add(rule.get());
	return SUCCEEDED(result);
}
}

namespace WindowsFirewall
{
bool blockInternet()
{
	const ComInit com;
	if(!com.usable()) return false;
	ComPtr<INetFwPolicy2> policy;
	ComPtr<INetFwRules> rules;
	if(!openFirewall(policy, rules) || !activeProfilesAreEnabled(policy.get())) return false;
	if(!removeAll(rules.get())) return false;
	for(const auto& spec : Rules)
	{
		if(!addRule(rules.get(), spec))
		{
			removeAll(rules.get());
			qWarning("[InternetGuard] transactional rule application failed; pilot rules rolled back");
			return false;
		}
	}
	return true;
}

bool allowInternet()
{
	const ComInit com;
	if(!com.usable()) return false;
	ComPtr<INetFwPolicy2> policy;
	ComPtr<INetFwRules> rules;
	return openFirewall(policy, rules) && removeAll(rules.get());
}
}
