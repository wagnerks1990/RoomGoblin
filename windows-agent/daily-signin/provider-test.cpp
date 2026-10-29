// Non-installing Windows COM smoke: load only, no registry/account/service writes.
#include <windows.h>
#include <credentialprovider.h>
#include <cstdio>
static const CLSID ClassId={0xd9d7c883,0x47d8,0x4a46,{0xbd,0x48,0x0a,0xc6,0x1f,0x32,0x9d,0x80}};
static int checks=0;
static void Check(bool value){if(!value){std::fprintf(stderr,"Provider check %d failed\n",checks+1);ExitProcess(1);}checks++;}
int wmain(int argc,wchar_t** argv){
    if(argc!=2)return 2;
    CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
    auto module=LoadLibraryExW(argv[1],nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_SYSTEM32);Check(module!=nullptr);
    auto get=reinterpret_cast<HRESULT(__stdcall*)(REFCLSID,REFIID,void**)>(GetProcAddress(module,"DllGetClassObject"));
    auto unload=reinterpret_cast<HRESULT(__stdcall*)()>(GetProcAddress(module,"DllCanUnloadNow"));Check(get&&unload);
    Check(unload()==S_OK);IClassFactory* factory=nullptr;
    Check(SUCCEEDED(get(ClassId,IID_IClassFactory,reinterpret_cast<void**>(&factory))));Check(unload()==S_FALSE);
    ICredentialProvider* provider=nullptr;
    Check(SUCCEEDED(factory->CreateInstance(nullptr,IID_ICredentialProvider,reinterpret_cast<void**>(&provider))));
    DWORD count=0;Check(SUCCEEDED(provider->GetFieldDescriptorCount(&count))&&count==3);
    CREDENTIAL_PROVIDER_FIELD_DESCRIPTOR* field=nullptr;
    Check(SUCCEEDED(provider->GetFieldDescriptorAt(1,&field))&&field->cpft==CPFT_PASSWORD_TEXT);
    CoTaskMemFree(field->pszLabel);CoTaskMemFree(field);
    Check(provider->GetFieldDescriptorAt(99,&field)==E_INVALIDARG);
    Check(provider->SetUsageScenario(CPUS_CREDUI,0)==E_NOTIMPL);
    Check(provider->SetUsageScenario(CPUS_CHANGE_PASSWORD,0)==E_NOTIMPL);
    BOOL automatic=TRUE;DWORD selected=0;
    Check(SUCCEEDED(provider->GetCredentialCount(&count,&selected,&automatic))&&count==0&&!automatic);
    provider->Release();factory->Release();Check(unload()==S_OK);
    FreeLibrary(module);CoUninitialize();
    std::printf("Windows credential-provider COM smoke: %d passed, 0 failed, 0 skipped. No installation.\n",checks);return 0;
}
