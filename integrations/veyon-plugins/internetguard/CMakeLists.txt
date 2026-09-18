if(NOT VEYON_BUILD_WINDOWS)
	return()
endif()

include(BuildVeyonPlugin)

build_veyon_plugin(internetguard
	NAME InternetGuard
	SOURCES
	InternetGuardPlugin.cpp
	InternetGuardPlugin.h
	WindowsFirewall.cpp
	WindowsFirewall.h
	)

target_link_libraries(internetguard PRIVATE ole32 oleaut32)
