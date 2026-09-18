include(BuildVeyonPlugin)

build_veyon_plugin(internetguard
	NAME InternetGuard
	SOURCES
	InternetGuardPlugin.cpp
	InternetGuardPlugin.h
	WindowsFirewall.h
	)

if(VEYON_BUILD_WINDOWS)
	target_sources(internetguard PRIVATE WindowsFirewall.cpp)
	target_link_libraries(internetguard PRIVATE ole32 oleaut32)
endif()
