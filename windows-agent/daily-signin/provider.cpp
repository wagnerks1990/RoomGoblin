// RoomGoblin Windows x64 credential provider. Copyright Kyle Wagner.
// No provider filter: Windows and administrator recovery tiles remain available.
#define SECURITY_WIN32
#include <windows.h>
#include <credentialprovider.h>
#include <ntsecapi.h>
#include <wincred.h>
#include <shlobj.h>
#include <string>
#include <vector>
#include <new>

static const CLSID ClassId = {0xd9d7c883,0x47d8,0x4a46,{0xbd,0x48,0x0a,0xc6,0x1f,0x32,0x9d,0x80}};
static LONG objects = 0;
static HRESULT Copy(const wchar_t* value, PWSTR* result) {
    if (!result) return E_POINTER;
    size_t bytes = (wcslen(value)+1)*sizeof(wchar_t);
    *result = static_cast<PWSTR>(CoTaskMemAlloc(bytes));
    if (!*result) return E_OUTOFMEMORY;
    memcpy(*result,value,bytes); return S_OK;
}
static std::wstring Setting(const wchar_t* name) {
    wchar_t value[257] = {}; DWORD size = sizeof(value);
    if (RegGetValueW(HKEY_LOCAL_MACHINE,L"SOFTWARE\\RoomGoblin\\DailySignIn",name,RRF_RT_REG_SZ,nullptr,value,&size) != ERROR_SUCCESS) return L"";
    return value;
}
static bool TrustedServer(HANDLE pipe) {
    ULONG pid = 0;
    if (!GetNamedPipeServerProcessId(pipe,&pid)) return false;
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION,FALSE,pid), token = nullptr;
    if (!process) return false;
    wchar_t path[1024] = {}; DWORD length = 1024; bool trusted = false;
    PWSTR programs = nullptr;
    if (QueryFullProcessImageNameW(process,0,path,&length) && SUCCEEDED(SHGetKnownFolderPath(FOLDERID_ProgramFiles,0,nullptr,&programs)) && OpenProcessToken(process,TOKEN_QUERY,&token)) {
        BYTE user[512] = {}; DWORD needed = 0;
        std::wstring expected = std::wstring(programs)+L"\\RoomGoblin\\SignIn\\RoomGoblinSignIn.exe";
        trusted = _wcsicmp(path,expected.c_str()) == 0 && GetTokenInformation(token,TokenUser,user,sizeof(user),&needed) &&
            IsWellKnownSid(reinterpret_cast<TOKEN_USER*>(user)->User.Sid,WinLocalSystemSid);
        SecureZeroMemory(user,sizeof(user));
    }
    if (programs) CoTaskMemFree(programs);
    if (token) CloseHandle(token);
    CloseHandle(process); return trusted;
}
static bool Transfer(HANDLE pipe, void* data, DWORD length, bool writing, ULONGLONG end) {
    BYTE* cursor = static_cast<BYTE*>(data);
    while (length) {
        if (GetTickCount64() >= end) return false;
        OVERLAPPED operation = {}; operation.hEvent = CreateEventW(nullptr,TRUE,FALSE,nullptr);
        if (!operation.hEvent) return false;
        DWORD done = 0;
        BOOL ok = writing ? WriteFile(pipe,cursor,length,&done,&operation) : ReadFile(pipe,cursor,length,&done,&operation);
        if (!ok && GetLastError() == ERROR_IO_PENDING) {
            ULONGLONG now = GetTickCount64(); DWORD remaining = now < end ? static_cast<DWORD>(end-now) : 0;
            if (WaitForSingleObject(operation.hEvent,remaining) != WAIT_OBJECT_0) {
                CancelIoEx(pipe,&operation); GetOverlappedResult(pipe,&operation,&done,TRUE); CloseHandle(operation.hEvent); return false;
            }
            ok = GetOverlappedResult(pipe,&operation,&done,FALSE);
        }
        CloseHandle(operation.hEvent);
        if (!ok || !done || done > length) return false;
        cursor += done; length -= done;
    }
    return true;
}
#pragma pack(push,1)
struct Request { DWORD magic=0x52475349, version=1; wchar_t code[9] = {}; };
struct Reply { DWORD accepted=0; wchar_t username[257]={}, domain[257]={}, password[130]={}; };
#pragma pack(pop)
static_assert(sizeof(Request)==26 && sizeof(Reply)==1292,"IPC layout drift");
static bool Validate(const wchar_t* code, Reply& reply) {
    HANDLE pipe = CreateFileW(L"\\\\.\\pipe\\RoomGoblin.DailySignIn.v1",GENERIC_READ|GENERIC_WRITE,0,nullptr,OPEN_EXISTING,
        FILE_FLAG_OVERLAPPED|SECURITY_SQOS_PRESENT|SECURITY_IDENTIFICATION,nullptr);
    if (pipe == INVALID_HANDLE_VALUE) return false;
    bool ok = false; Request request;
    if (TrustedServer(pipe) && wcslen(code)==8) {
        memcpy(request.code,code,8*sizeof(wchar_t)); ULONGLONG end=GetTickCount64()+5000;
        ok = Transfer(pipe,&request,sizeof(request),true,end) && Transfer(pipe,&reply,sizeof(reply),false,end) && reply.accepted==1 &&
            reply.username[256]==0 && reply.domain[256]==0 && reply.password[129]==0 && reply.username[0] && reply.password[0];
    }
    SecureZeroMemory(&request,sizeof(request)); CloseHandle(pipe); return ok;
}
static HRESULT Serialize(Reply& reply, CREDENTIAL_PROVIDER_USAGE_SCENARIO scenario, CREDENTIAL_PROVIDER_CREDENTIAL_SERIALIZATION* output) {
    // Follow the Windows password-provider contract: protect the password, then
    // pack relative UNICODE_STRING offsets for Negotiate/LSA, which authenticates it.
    DWORD characters=0;
    if (CredProtectW(FALSE,reply.password,static_cast<DWORD>(wcslen(reply.password)+1),nullptr,&characters,nullptr) || GetLastError()!=ERROR_INSUFFICIENT_BUFFER || characters>2048) return E_FAIL;
    std::vector<wchar_t> protectedPassword(characters);
    if (!CredProtectW(FALSE,reply.password,static_cast<DWORD>(wcslen(reply.password)+1),protectedPassword.data(),&characters,nullptr)) return E_FAIL;
    HANDLE lsa=nullptr; ULONG package=0; char negotiate[]="Negotiate";
    LSA_STRING name={9,10,negotiate};
    NTSTATUS status=LsaConnectUntrusted(&lsa);
    if (status>=0) { status=LsaLookupAuthenticationPackage(lsa,&name,&package); LsaDeregisterLogonProcess(lsa); }
    if (status<0) { SecureZeroMemory(protectedPassword.data(),protectedPassword.size()*2); return E_FAIL; }
    DWORD bytes=sizeof(KERB_INTERACTIVE_UNLOCK_LOGON)+static_cast<DWORD>((wcslen(reply.domain)+wcslen(reply.username)+wcslen(protectedPassword.data()))*2);
    auto buffer=static_cast<BYTE*>(CoTaskMemAlloc(bytes));
    if (!buffer) { SecureZeroMemory(protectedPassword.data(),protectedPassword.size()*2); return E_OUTOFMEMORY; }
    ZeroMemory(buffer,bytes); auto packed=reinterpret_cast<KERB_INTERACTIVE_UNLOCK_LOGON*>(buffer);
    packed->Logon.MessageType=scenario==CPUS_UNLOCK_WORKSTATION ? KerbWorkstationUnlockLogon : KerbInteractiveLogon;
    DWORD offset=sizeof(*packed);
    auto append=[&](UNICODE_STRING& dest,const wchar_t* source) {
        dest.Length=static_cast<USHORT>(wcslen(source)*2); dest.MaximumLength=dest.Length;
        memcpy(buffer+offset,source,dest.Length); dest.Buffer=reinterpret_cast<PWSTR>(static_cast<ULONG_PTR>(offset)); offset+=dest.Length;
    };
    append(packed->Logon.LogonDomainName,reply.domain); append(packed->Logon.UserName,reply.username); append(packed->Logon.Password,protectedPassword.data());
    SecureZeroMemory(protectedPassword.data(),protectedPassword.size()*2);
    output->ulAuthenticationPackage=package; output->clsidCredentialProvider=ClassId; output->cbSerialization=bytes; output->rgbSerialization=buffer;
    return S_OK;
}

class Credential final : public ICredentialProviderCredential2 {
    LONG references=1; CREDENTIAL_PROVIDER_USAGE_SCENARIO scenario; ICredentialProviderCredentialEvents* events=nullptr;
    wchar_t code[9]={}; std::wstring sid;
    void Clear() { SecureZeroMemory(code,sizeof(code)); if(events) events->SetFieldString(this,1,L""); }
public:
    explicit Credential(CREDENTIAL_PROVIDER_USAGE_SCENARIO value):scenario(value),sid(Setting(L"AccountSid")) { InterlockedIncrement(&objects); }
    ~Credential() { SecureZeroMemory(code,sizeof(code)); if(events) events->Release(); InterlockedDecrement(&objects); }
    IFACEMETHODIMP QueryInterface(REFIID id,void** out) override {
        if(!out)return E_POINTER; *out=nullptr;
        if(id==IID_IUnknown || id==IID_ICredentialProviderCredential || id==IID_ICredentialProviderCredential2) *out=static_cast<ICredentialProviderCredential2*>(this);
        if(!*out)return E_NOINTERFACE; AddRef(); return S_OK;
    }
    IFACEMETHODIMP_(ULONG) AddRef() override {return InterlockedIncrement(&references);}
    IFACEMETHODIMP_(ULONG) Release() override {auto n=InterlockedDecrement(&references);if(!n)delete this;return n;}
    IFACEMETHODIMP Advise(ICredentialProviderCredentialEvents* value) override {if(events)events->Release();events=value;if(events)events->AddRef();return S_OK;}
    IFACEMETHODIMP UnAdvise() override {if(events){events->Release();events=nullptr;}return S_OK;}
    IFACEMETHODIMP SetSelected(BOOL* automatic) override {if(!automatic)return E_POINTER;*automatic=FALSE;return S_OK;}
    IFACEMETHODIMP SetDeselected() override {Clear();return S_OK;}
    IFACEMETHODIMP GetFieldState(DWORD field,CREDENTIAL_PROVIDER_FIELD_STATE* state,CREDENTIAL_PROVIDER_FIELD_INTERACTIVE_STATE* interactive) override {
        if(field>2||!state||!interactive)return E_INVALIDARG;*state=CPFS_DISPLAY_IN_SELECTED_TILE;*interactive=field==1?CPFIS_FOCUSED:CPFIS_NONE;return S_OK;
    }
    IFACEMETHODIMP GetStringValue(DWORD field,PWSTR* value) override {
        if(field==0)return Copy(L"RoomGoblin daily code\nRun the room. Manage the lab.\nKyle Wagner",value);
        if(field==1)return Copy(code,value);if(field==2)return Copy(L"Sign in",value);return E_INVALIDARG;
    }
    IFACEMETHODIMP GetBitmapValue(DWORD,HBITMAP*) override {return E_NOTIMPL;}
    IFACEMETHODIMP GetCheckboxValue(DWORD,BOOL*,PWSTR*) override {return E_NOTIMPL;}
    IFACEMETHODIMP GetSubmitButtonValue(DWORD field,DWORD* adjacent) override {if(field!=2||!adjacent)return E_INVALIDARG;*adjacent=1;return S_OK;}
    IFACEMETHODIMP GetComboBoxValueCount(DWORD,DWORD*,DWORD*) override {return E_NOTIMPL;}
    IFACEMETHODIMP GetComboBoxValueAt(DWORD,DWORD,PWSTR*) override {return E_NOTIMPL;}
    IFACEMETHODIMP SetStringValue(DWORD field,PCWSTR value) override {
        if(field!=1||!value||wcslen(value)>8)return E_INVALIDARG;
        for(auto p=value;*p;p++)if(*p<L'0'||*p>L'9')return E_INVALIDARG;
        SecureZeroMemory(code,sizeof(code));memcpy(code,value,wcslen(value)*2);return S_OK;
    }
    IFACEMETHODIMP SetCheckboxValue(DWORD,BOOL) override {return E_NOTIMPL;}
    IFACEMETHODIMP SetComboBoxSelectedValue(DWORD,DWORD) override {return E_NOTIMPL;}
    IFACEMETHODIMP CommandLinkClicked(DWORD) override {return E_NOTIMPL;}
    IFACEMETHODIMP GetSerialization(CREDENTIAL_PROVIDER_GET_SERIALIZATION_RESPONSE* result,CREDENTIAL_PROVIDER_CREDENTIAL_SERIALIZATION* output,PWSTR* message,CREDENTIAL_PROVIDER_STATUS_ICON* icon) override {
        if(!result||!output||!message||!icon)return E_POINTER;
        *result=CPGSR_NO_CREDENTIAL_NOT_FINISHED;ZeroMemory(output,sizeof(*output));*message=nullptr;*icon=CPSI_ERROR;
        Reply reply; bool accepted=Validate(code,reply); Clear();
        HRESULT hr=accepted?Serialize(reply,scenario,output):E_FAIL;
        SecureZeroMemory(&reply,sizeof(reply));
        if(SUCCEEDED(hr)){*result=CPGSR_RETURN_CREDENTIAL_FINISHED;*icon=CPSI_NONE;return S_OK;}
        Copy(L"Code not accepted or sign-in service unavailable. Check today's code, wait after repeated attempts, or use your administrator recovery account.",message);
        return S_OK;
    }
    IFACEMETHODIMP ReportResult(NTSTATUS,NTSTATUS,PWSTR* message,CREDENTIAL_PROVIDER_STATUS_ICON* icon) override {Clear();if(message)*message=nullptr;if(icon)*icon=CPSI_NONE;return S_OK;}
    IFACEMETHODIMP GetUserSid(PWSTR* value) override {return sid.empty()?E_UNEXPECTED:Copy(sid.c_str(),value);}
};

class Provider final : public ICredentialProvider, public ICredentialProviderSetUserArray {
    LONG references=1; Credential* credential=nullptr;
public:
    Provider(){InterlockedIncrement(&objects);} ~Provider(){if(credential)credential->Release();InterlockedDecrement(&objects);}
    IFACEMETHODIMP QueryInterface(REFIID id,void** out) override {
        if(!out)return E_POINTER;*out=nullptr;
        if(id==IID_IUnknown||id==IID_ICredentialProvider)*out=static_cast<ICredentialProvider*>(this);
        else if(id==IID_ICredentialProviderSetUserArray)*out=static_cast<ICredentialProviderSetUserArray*>(this);
        if(!*out)return E_NOINTERFACE;AddRef();return S_OK;
    }
    IFACEMETHODIMP_(ULONG) AddRef() override {return InterlockedIncrement(&references);}
    IFACEMETHODIMP_(ULONG) Release() override {auto n=InterlockedDecrement(&references);if(!n)delete this;return n;}
    IFACEMETHODIMP SetUsageScenario(CREDENTIAL_PROVIDER_USAGE_SCENARIO value,DWORD) override {
        if(credential){credential->Release();credential=nullptr;}
        if(value!=CPUS_LOGON&&value!=CPUS_UNLOCK_WORKSTATION)return E_NOTIMPL;
        if(Setting(L"AccountSid").empty())return E_UNEXPECTED;
        credential=new(std::nothrow) Credential(value);return credential?S_OK:E_OUTOFMEMORY;
    }
    IFACEMETHODIMP SetSerialization(const CREDENTIAL_PROVIDER_CREDENTIAL_SERIALIZATION*) override {return E_NOTIMPL;}
    IFACEMETHODIMP Advise(ICredentialProviderEvents*,UINT_PTR) override {return S_OK;}
    IFACEMETHODIMP UnAdvise() override {return S_OK;}
    IFACEMETHODIMP GetFieldDescriptorCount(DWORD* count) override {if(!count)return E_POINTER;*count=3;return S_OK;}
    IFACEMETHODIMP GetFieldDescriptorAt(DWORD field,CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR** result) override {
        if(!result||field>2)return E_INVALIDARG;*result=nullptr;
        auto descriptor=static_cast<CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR*>(CoTaskMemAlloc(sizeof(CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR)));
        if(!descriptor)return E_OUTOFMEMORY;ZeroMemory(descriptor,sizeof(*descriptor));descriptor->dwFieldID=field;
        descriptor->cpft=field==0?CPFT_LARGE_TEXT:field==1?CPFT_PASSWORD_TEXT:CPFT_SUBMIT_BUTTON;
        auto hr=Copy(field==1?L"Today's eight-digit RoomGoblin code":L"RoomGoblin",&descriptor->pszLabel);
        if(FAILED(hr)){CoTaskMemFree(descriptor);return hr;}*result=descriptor;return S_OK;
    }
    IFACEMETHODIMP GetCredentialCount(DWORD* count,DWORD* selected,BOOL* automatic) override {if(!count||!selected||!automatic)return E_POINTER;*count=credential?1:0;*selected=credential?0:CREDENTIAL_PROVIDER_NO_DEFAULT;*automatic=FALSE;return S_OK;}
    IFACEMETHODIMP GetCredentialAt(DWORD index,ICredentialProviderCredential** result) override {if(index||!credential||!result)return E_INVALIDARG;*result=credential;credential->AddRef();return S_OK;}
    IFACEMETHODIMP SetUserArray(ICredentialProviderUserArray*) override {return S_OK;}
};
class Factory final : public IClassFactory {
    LONG references=1;
public:
    Factory(){InterlockedIncrement(&objects);} ~Factory(){InterlockedDecrement(&objects);}
    IFACEMETHODIMP QueryInterface(REFIID id,void** out) override {if(!out)return E_POINTER;*out=nullptr;if(id!=IID_IUnknown&&id!=IID_IClassFactory)return E_NOINTERFACE;*out=static_cast<IClassFactory*>(this);AddRef();return S_OK;}
    IFACEMETHODIMP_(ULONG) AddRef() override {return InterlockedIncrement(&references);}
    IFACEMETHODIMP_(ULONG) Release() override {auto n=InterlockedDecrement(&references);if(!n)delete this;return n;}
    IFACEMETHODIMP CreateInstance(IUnknown* outer,REFIID id,void** result) override {if(outer)return CLASS_E_NOAGGREGATION;auto p=new(std::nothrow) Provider();if(!p)return E_OUTOFMEMORY;auto hr=p->QueryInterface(id,result);p->Release();return hr;}
    IFACEMETHODIMP LockServer(BOOL lock) override {if(lock)InterlockedIncrement(&objects);else InterlockedDecrement(&objects);return S_OK;}
};
extern "C" __declspec(dllexport) HRESULT __stdcall DllGetClassObject(REFCLSID id,REFIID iid,void** result) {
    if(id!=ClassId)return CLASS_E_CLASSNOTAVAILABLE;auto factory=new(std::nothrow) Factory();if(!factory)return E_OUTOFMEMORY;
    auto hr=factory->QueryInterface(iid,result);factory->Release();return hr;
}
extern "C" __declspec(dllexport) HRESULT __stdcall DllCanUnloadNow(){return objects==0?S_OK:S_FALSE;}
BOOL WINAPI DllMain(HINSTANCE instance,DWORD reason,LPVOID){if(reason==DLL_PROCESS_ATTACH)DisableThreadLibraryCalls(instance);return TRUE;}
